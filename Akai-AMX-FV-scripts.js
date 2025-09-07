/**
 * Required controller object for Mixxx.
 *
 * Connected by the functionprefix attribute in the midi.xml file.
 *
 * @see https://github.com/mixxxdj/mixxx/wiki/Midi-Scripting#script-file-header
 */
var AMXFV = {};
AMXFV.midiChannel = 0;

const NOTE_ON = 0x90 + AMXFV.midiChannel;
const NOTE_OFF = 0x80 + AMXFV.midiChannel;
const CONTROL_NUMBER    = 0xB0 + AMXFV.midiChannel;
const VALUE_ON = 0X7f;
const VALUE_OFF = 0X00;

////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*     Central object that describes the controller.                *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////

/**
 * Central object to store and get midi mapping values.
 */
AMXFV.mapping = function () {
};

AMXFV.mapping.prototype = {
    layout: {
        'search': [0x02, 0x03],
        'load': [0x04, 0x05],
        'shift': 0x00,
        'sync': [0x06, 0x07],
        'cue': [0x08, 0x09],
        'play': [0x0A, 0x0B],
        'eqTrebleLSB': [0x0A, 0x0E],
        'eqTrebleMSB': [0x2A, 0x2E],
        'eqMidLSB': [0x09, 0x0D],
        'eqMidMSB': [0x29, 0x2D],
        'eqBassLSB': [0x08, 0x0C],
        'eqBassMSB': [0x28, 0x2C],
        'lineFaderLSB': [0x07, 0x0B],
        'lineFaderMSB': [0x27, 0x2B],
        'crossfader': 0x21,
    },

    getControl: function(controlName, layoutIndex) {
        if (typeof layoutIndex === 'number'
            && Array.isArray(this.layout[controlName])
            && typeof this.layout[controlName][layoutIndex] === 'number'
        ) {
            return this.layout[controlName][layoutIndex];
        }

        if (typeof this.layout[controlName] === 'number') {
            return this.layout[controlName];
        }

        console.warn(`no valid midi number found for control name: ${controlName}`);
    }

}

/**
 * Extension of the mapping object for a specific index and deck number.
 *
 * @param {number} index
 *   Starting with 0 for usage in an array. So your first set of controls has index 0, your second has index 1.
 * @param {number} groupNumber
 *   Referring to the group numbers as Mixxx expect them. So 1 for the first group, 2 for the second. In the Mixxx
 *   documentation this number is referred to as N. See: https://manual.mixxx.org/2.6/en/chapters/appendix/mixxx_controls.html#decks-preview-decks-and-samplers
 */
AMXFV.groupMapping = function (index, groupNumber) {

    this.getIndex = function () {
        return index;
    };
    this.getGroupNumber = function () {
        return groupNumber;
    };

    this.getControl = function(controlName, overwriteIndex) {
        let layoutIndex = index;
        if (typeof overwriteIndex === 'number') {
            layoutIndex = overwriteIndex;
        }

        if (typeof this.layout[controlName][layoutIndex] === 'number') {
            return this.layout[controlName][layoutIndex];
        }

        console.warn(`no valid midi number found for control name: ${controlName}`);
    };

}

AMXFV.groupMapping.prototype = AMXFV.mapping.prototype;

////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*                Required  Mixxx javascript methods                *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////

/**
 * Required Mixxx init function.
 *
 * @see https://github.com/mixxxdj/mixxx/wiki/Midi-Scripting#script-file-header
 */
AMXFV.init = function () {
    this.deckMappingList = [
        new AMXFV.groupMapping(0, 1),
        new AMXFV.groupMapping(1, 2)
    ];

    this.global = new AMXFV.Global(new AMXFV.mapping(), this.deckMappingList);

    this.mixerLineContainer = new components.ComponentContainer();
    this.deckBasicsContainer = new components.ComponentContainer();

    // Build the components group that are present for each channel at the same time.
    this.deckMappingList.forEach((function(deckMapping){
        this.mixerLineContainer[deckMapping.getIndex()] = new AMXFV.MixerLine(deckMapping);
        this.deckBasicsContainer[deckMapping.getIndex()] = new AMXFV.DeckBasics(deckMapping);
    }).bind(this));

    this.deckExtrasLayer = new components.ComponentContainer();

    // Build layers and add them to the layer button's that are created in the global component container.
    this.deckMappingList.forEach((function(deckMapping){
        let deckNumber = deckMapping.getGroupNumber();
        // Add the default components to the layer button.
        this.global[`layerButtonDeck${deckNumber}`].registerDefaultContainer(this.deckBasicsContainer);

        // Build the parts that can be enabled as layer and add them to the layer button.
        this.deckExtrasLayer[`deckExtrasLayer${deckNumber}`] = new AMXFV.DeckExtras(deckMapping);
        this.global[`layerButtonDeck${deckNumber}`].registerLayerContainer(this.deckExtrasLayer[`deckExtrasLayer${deckNumber}`]);
    }).bind(this));

    this.global.shiftButton.registerComponent(this.deckBasicsContainer);
};

/**
 * Required Mixxx shutdown function.
 *
 * @see https://github.com/mixxxdj/mixxx/wiki/Midi-Scripting#script-file-header
 */
AMXFV.shutdown = function () {
    this.mixerLineContainer.shutdown();
    this.deckBasicsContainer.shutdown();
    this.deckExtrasLayer.shutdown();
    this.global.shutdown();
};

////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*  Components JS implementation for a Global and Master container  *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////

/**
 * Global constructor
 *
 * To place global components not related to mixxx controls, e.g. the shift button and buttons to activate layers.
 */
AMXFV.Global = function(mapping, deckMappingList) {

        this.shiftButton = new AMXFV.ShiftButton({
            midiIn: [[NOTE_ON, mapping.getControl('shift')], [NOTE_OFF, mapping.getControl('shift')]],
        });

        deckMappingList.forEach((function(deckMapping){
            this[`layerButtonDeck${deckMapping.getGroupNumber()}`] = new AMXFV.LayerButton({
                midiIn: [[NOTE_ON, deckMapping.getControl('search')], [NOTE_OFF, deckMapping.getControl('search')]],
            });
        }).bind(this));

        this.reconnectComponents(function (component) {
            if (component.group === undefined) {
                component.group = "[Global]";
            }
        });

};
AMXFV.Global.prototype = new components.ComponentContainer();



////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*            Components JS implementations for Deck's              *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////

/**
 * Constructor for a channel on the mixer with controls like eq, volume etc.
 *
 * @param {AMXFV.groupMapping} channelMapping
 *   Instance of group mapping object.
 */
AMXFV.MixerLine = function (channelMapping) {
    components.Deck.call(this, channelMapping.getGroupNumber());

    this.equalizerRack = new AMXFV.EqualizerRack(channelMapping, 1);

    this.lineFader = new components.Pot({
        midiIn: [[CONTROL_NUMBER, channelMapping.getControl('lineFaderLSB')], [CONTROL_NUMBER, channelMapping.getControl('lineFaderMSB')]],
        inKey: 'volume'
    });

    // Connect all components of this deck to the same control group.
    this.reconnectComponents(function (component) {
        if (component.group === undefined) {
            component.group = this.currentDeck;
        }
    });
};
AMXFV.MixerLine.prototype = new components.Deck([]);

/**
 * Equalizer rack constructor
 *
 * @param {AMXFV.groupMapping} channelMapping
 *   Instance of group mapping object.
 * @param {number} rackNumber
 *   Number of the equalizer rack.
 */
AMXFV.EqualizerRack = function(channelMapping, rackNumber) {

    this.filterHigh = new components.Pot({
        midiIn: [[CONTROL_NUMBER, channelMapping.getControl('eqTrebleLSB')], [CONTROL_NUMBER, channelMapping.getControl('eqTrebleMSB')]],
        inKey: `parameter3`
    });

    this.filterMid = new components.Pot({
        midiIn: [[CONTROL_NUMBER, channelMapping.getControl('eqMidLSB')], [CONTROL_NUMBER, channelMapping.getControl('eqMidMSB')]],
        inKey: 'parameter2'
    });

    this.filterLow = new components.Pot({
        midiIn: [[CONTROL_NUMBER, channelMapping.getControl('eqBassLSB')], [CONTROL_NUMBER, channelMapping.getControl('eqBassMSB')]],
        inKey: 'parameter1'
    });

    this.reconnectComponents(function (component) {
        if (component.group === undefined) {
            component.group = `[EqualizerRack${rackNumber}_[Channel${channelMapping.getGroupNumber()}]_Effect1]`;
        }
    });

};
AMXFV.EqualizerRack.prototype = new components.ComponentContainer();

/**
 * Constructor for the most basic deck functionality.
 *
 * This should be de default for the controller.
 * Switching to DeckExtra's can be done by the layer button (search) button on the controller.
 *
 * @param {AMXFV.groupMapping} channelMapping
 *   Instance of group mapping object.
 */
AMXFV.DeckBasics = function (channelMapping) {
    components.Deck.call(this, channelMapping.getGroupNumber());

    this.syncButton = new components.SyncButton({
        midiIn: [NOTE_ON, channelMapping.getControl('sync')],
        midiOut: [NOTE_ON, channelMapping.getControl('sync')],
    });

    this.playButton = new components.PlayButton({
        midiIn: [NOTE_ON, channelMapping.getControl('play')],
        midiOut: [NOTE_ON, channelMapping.getControl('play')]
    });

    // Connect all components of this deck to the same control group.
    this.reconnectComponents(function (component) {
        if (component.group === undefined) {
            component.group = this.currentDeck;
        }
    });
};
AMXFV.DeckBasics.prototype = new components.Deck([]);

/**
 * Constructor for additional deck functionality.
 *
 * Use the layer (search) button to switch buttons and encoders to the extra's that are configured here.
 *
 * @param {AMXFV.groupMapping} channelMapping
 *   Instance of group mapping object.
 */
AMXFV.DeckExtras = function (channelMapping) {
    components.Deck.call(this, channelMapping.getGroupNumber());
    let leftDeckIndex = 0; // leftDeckIndex
    let rightDeckIndex = 1; // rightDeckIndex

    this.jumpBackButton = new components.Button({
        midiIn: [[NOTE_ON, channelMapping.getControl('load', leftDeckIndex)], [NOTE_OFF, channelMapping.getControl('load', leftDeckIndex)]],
        midiOut: [NOTE_ON, channelMapping.getControl('load', leftDeckIndex)],
        inKey: 'beatjump_backward',
    });

    this.jumpFowardButton = new components.Button({
        midiIn: [[NOTE_ON, channelMapping.getControl('load', rightDeckIndex)], [NOTE_OFF, channelMapping.getControl('load', rightDeckIndex)]],
        midiOut: [NOTE_ON, channelMapping.getControl('load', rightDeckIndex)],
        inKey: 'beatjump_forward',
    });

    // Connect all components of this deck to the same control group.
    this.reconnectComponents(function (component) {
        if (component.group === undefined) {
            component.group = this.currentDeck;
        }
    });
};

AMXFV.DeckExtras.prototype = new components.Deck([])

////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*                      Custom components                           *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////

/**
 * Shift Button
 *
 * Observer Subject where every component or collection of components
 * (component container) can subscribe to. This observer subject
 * notifies its subscribers by calling the shift and unshift methods.
 *
 * At initialisation create an object e.g.
 * MyController.shiftButton = new AMXFV.ShiftButton();
 *
 * Then register a separate component like a button or a
 * component container with multiple components, like a deck.
 * MyController.shiftButton->registerComponentContainer(MyController.Deck)
 *
 * @param options array
 * Midi components options array, see midi-components-0.0.js
 */
AMXFV.ShiftButton = (function() {

    let componentCollection = [];
    function ShiftButton(options) {
        components.Button.call(this, options);

        this.registerComponent = function (component) {
            if (component instanceof components.Component || component instanceof components.ComponentContainer) {
                componentCollection.push(component);
            }
        };

        this.input = function (channel, control, value, status, group) {
            this.action = 'unshift';
            if (value === VALUE_ON) {
                this.action = 'shift';
            }
            notifySubscribers(this.action, componentCollection);
        };
    }

    function notifySubscribers(action, subscribers) {
        subscribers.forEach(function (component) {
            component[action]();
        });
    }

    ShiftButton.prototype = Object.create(components.Button.prototype);
    return ShiftButton;
}());

/**
 * Layer Button
 *
 * Each instantiation of the layer button represents one layer, e.g. a layer for one deck.
 *
 * Register as default layer all the component containers that are replaced by the layer.
 * MyController.layerButton->registerComponentContainer(MyController.Deck)
 *
 * Register as layer all the component containers that should be used when the layer button is pressed.
 *
 * The layer is only active as long as the layer button is pressed, when releasing the button the mapping
 * is switched back to the default layer.
 *
 * @param options array
 * Midi components options array, see midi-components-0.0.js
 */
AMXFV.LayerButton = (function () {

    function LayerButton(options) {
        components.Button.call(this, options)

        this.defaultLayer = [];
        this.layer = [];

        this.registerDefaultContainer = (function (component) {
            if (component instanceof components.ComponentContainer) {
                this.defaultLayer.push(component);
            }
        }).bind(this);

        this.registerLayerContainer = (function (component) {
            if (component instanceof components.ComponentContainer) {
                this.layer.push(component);
            }
            disconnectLayer(this.layer);
        }).bind(this);


        this.input = function (channel, control, value, status, group) {
            if (value === VALUE_ON) {
                disconnectLayer(this.defaultLayer);
                connectLayer(this.layer);
            } else if (value === VALUE_OFF) {
                disconnectLayer(this.layer);
                connectLayer(this.defaultLayer);
            }
        };
    }

    function disconnectLayer(layer){
        layer.forEach(function (componentContainer) {
            disconnectComponentContainer(componentContainer)
        });
    }
    function disconnectComponentContainer(componentContainer) {
        componentContainer.forEachComponent(function (component) {
            if (typeof component.disconnect === "function") {
                component.disconnect();
            }
        });
    }

    function connectLayer(layer) {
        layer.forEach(function (componentContainer) {
            connectComponentContainer(componentContainer)
        });
    }
    function connectComponentContainer(componentContainer) {
        componentContainer.forEachComponent(function (component) {
            if (typeof component.connect === "function") {
                component.connect();
                // component.trigger();
            }
        });
    }

    LayerButton.prototype = Object.create(components.Button.prototype);
    return LayerButton;
}());