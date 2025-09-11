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
const VALUE_ON = 0X7F;
const VALUE_OFF = 0X00;
const ENCODER_LEFT = 0X7F;
const ENCODER_RIGHT = 0X01;

let leftDeckMapping = null; // leftDeckIndex
let rightDeckMapping = null; //

////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*     Central object that describes the controller.                *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////

/**
 * Central object to store and get midi mapping values.
 */
AMXFV.globalMapping = function () {
};

AMXFV.globalMapping.prototype = {
    layout: {
        'search': [0x02, 0x03],
        'load': [0x04, 0x05],
        'shift': 0x00,
        'sync': [0x06, 0x07],
        'cue': [0x08, 0x09],
        'play': [0x0A, 0x0B],
        'pfl': [0x0C, 0x0D],
        'gain': [0x3C, 0x3D],
        'eqTrebleLSB': [0x0A, 0x0E],
        'eqTrebleMSB': [0x2A, 0x2E],
        'eqMidLSB': [0x09, 0x0D],
        'eqMidMSB': [0x29, 0x2D],
        'eqBassLSB': [0x08, 0x0C],
        'eqBassMSB': [0x28, 0x2C],
        'filterLSB': [0x0F, 0x10],
        'filterMSB': [0x2F, 0x30],
        'lineFaderLSB': [0x07, 0x0B],
        'lineFaderMSB': [0x27, 0x2B],
        'cueMix': 0x37,
        'cueGain': 0x33,
        'master': 0x32,
        'xfadeREV': 0x3A,
        'browseTurn': 0x3B,
        'browseClick': 0x1A,
        'crossFaderLSB': 0x01,
        'crossFaderMSB': 0x21,
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

AMXFV.groupMapping.prototype = AMXFV.globalMapping.prototype;

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
    this.globalMapping = new AMXFV.globalMapping();
    this.deckMappingList = [
        new AMXFV.groupMapping(0, 1),
        new AMXFV.groupMapping(1, 2)
    ];
    leftDeckMapping = this.deckMappingList[0];
    rightDeckMapping = this.deckMappingList[1];

    // Create containers with general mapping.
    this.global = new AMXFV.Global(this.globalMapping);
    this.library = new AMXFV.Library(this.globalMapping);
    this.master = new AMXFV.Master(this.globalMapping);

    // Create containers with per deck mapping.
    this.mixerLineContainer = new components.ComponentContainer();
    this.deckBasicsContainer = new components.ComponentContainer();
    this.deckExtrasContainer = new components.ComponentContainer();
    this.deckMappingList.forEach((function(deckMapping){
        let index = deckMapping.getIndex();
        this.mixerLineContainer[index] = new AMXFV.MixerLine(deckMapping);
        this.deckBasicsContainer[index] = new AMXFV.DeckBasics(deckMapping);
        this.deckExtrasContainer[index] = new AMXFV.DeckExtras(deckMapping, this.globalMapping);
    }).bind(this));

    // Add the layers to the given layer button.
    // On the controller the buttons with the text 'search' above and the number on the button.
    this.deckMappingList.forEach((function(deckMapping){
        let deckNumber = deckMapping.getGroupNumber();
        this.global["layer" + deckNumber].registerDefaultContainer(this.deckBasicsContainer);
        this.global["layer" + deckNumber].registerDefaultContainer(this.library);
        this.global["layer" + deckNumber].registerLayerContainer(this.deckExtrasContainer[deckMapping.getIndex()]);
    }).bind(this));

    // Register the containers that support shift functionality.
    this.global.shiftButton.registerComponent(this.library);
    this.global.shiftButton.registerComponent(this.deckBasicsContainer);
    this.global.shiftButton.registerComponent(this.deckExtrasContainer);
};

/**
 * Required Mixxx shutdown function.
 *
 * @see https://github.com/mixxxdj/mixxx/wiki/Midi-Scripting#script-file-header
 */
AMXFV.shutdown = function () {
    this.mixerLineContainer.shutdown();
    this.deckBasicsContainer.shutdown();
    this.deckExtrasContainer.shutdown();
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
AMXFV.Global = function(mapping) {

        this.shiftButton = new AMXFV.ShiftButton({
            midiIn: [[NOTE_ON, mapping.getControl('shift')], [NOTE_OFF, mapping.getControl('shift')]],
        });

        this.layer1 = new AMXFV.LayerButton({
            midiIn: [[NOTE_ON, mapping.getControl('search', leftDeckMapping.getIndex())], [NOTE_OFF, mapping.getControl('search', leftDeckMapping.getIndex())]],
        });

        this.layer2 = new AMXFV.LayerButton({
            midiIn: [[NOTE_ON, mapping.getControl('search', rightDeckMapping.getIndex())], [NOTE_OFF, mapping.getControl('search', rightDeckMapping.getIndex())]],
        });

        this.reconnectComponents(function (component) {
            if (component.group === undefined) {
                component.group = "[Global]";
            }
        });

};
AMXFV.Global.prototype = new components.ComponentContainer();

/**
 * Constructor for the library group controls in mixxx.
 */
AMXFV.Library = function(mapping) {

    this.browse = new components.Encoder({
        midiIn: [CONTROL_NUMBER, mapping.getControl('browseTurn')],
        input: function (channel, control, value, status, group) {
            if (value === 1) {
                this.inSetParameter(1);
            } else if (value === 127) {
                this.inSetParameter(- 1);
            }
        },
        unshift: function() {
            this.inKey = "MoveVertical";
        },
        shift: function() {
            this.inKey = "MoveHorizontal";
        }
    });

    this.browseClick = new components.Button({
        midiIn: [NOTE_ON, mapping.getControl('browseClick')],
        unshift: function() {
            this.inKey = "GoToItem";
        },
        shift: function() {
            this.inKey = "sort_focused_column";
        },
    });

    this.loadLeft = new components.Button({
        midiIn: [NOTE_ON, mapping.getControl('load', leftDeckMapping.getIndex())],
        unshift: function() {
            this.inKey = "LoadSelectedTrack";
            this.group = `[Channel${leftDeckMapping.getGroupNumber()}]`;
        },
        shift: function() {
            this.inKey = "MoveFocusBackward";
            this.group = '[Library]';
        },
    });

    this.loadRight = new components.Button({
        midiIn: [NOTE_ON, mapping.getControl('load', rightDeckMapping.getIndex())],
        unshift: function() {
            this.inKey = "LoadSelectedTrack";
            this.group = `[Channel${rightDeckMapping.getGroupNumber()}]`;
        },
        shift: function() {
            this.inKey = "MoveFocusForward";
            this.group = '[Library]'
        },
    });

    this.reconnectComponents(function (component) {
        if (component.group === undefined) {
            component.group = "[Library]";
        }
    });

};
AMXFV.Library.prototype = new components.ComponentContainer();

/**
 * Constructor for the master group controls in mixxx.
 */
AMXFV.Master = function(mapping) {

    this.cueMix = new components.Pot({
        midiIn: [[CONTROL_NUMBER, mapping.getControl('cueMix')], [CONTROL_NUMBER, mapping.getControl('cueMix')]],
        inKey: `headMix`
    });

    this.cueGain = new components.Pot({
        midiIn: [[CONTROL_NUMBER, mapping.getControl('cueGain')], [CONTROL_NUMBER, mapping.getControl('cueGain')]],
        inKey: `headGain`
    });

    this.masterGain = new components.Pot({
        midiIn: [[CONTROL_NUMBER, mapping.getControl('master')], [CONTROL_NUMBER, mapping.getControl('master')]],
        inKey: `gain`
    });

    // @TODO: support xfade rev (crossfader reverse or hamster style) button from the controller.

    this.crossFader = new components.Pot({
        midiIn: [[CONTROL_NUMBER, mapping.getControl('crossFaderLSB')], [CONTROL_NUMBER, mapping.getControl('crossFaderMSB')]],
        inKey: 'crossfader'
    });

    this.reconnectComponents(function (component) {
        if (component.group === undefined) {
            component.group = "[Master]";
        }
    });

};
AMXFV.Master.prototype = new components.ComponentContainer();

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

    this.filter = new components.Pot({
        midiIn: [[CONTROL_NUMBER, channelMapping.getControl('filterLSB')], [CONTROL_NUMBER, channelMapping.getControl('filterMSB')]],
        inKey: `super1`,
        group: `[QuickEffectRack1_[Channel${channelMapping.getGroupNumber()}]]`
        // group: "[QuickEffectRack1_[Channel1]]",
    });

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
    // @TODO provide support for touch control

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

    // This is in DeckBasics instead of MixerLine because it doubles in shift as pitch,
    // and it can be swapped out for other functionality in a Deck specific layer.
    this.gain = new components.Encoder({
        midiIn: [CONTROL_NUMBER, channelMapping.getControl('gain')],
        parameterStep: .02,
        input: function (channel, control, value, status, group) {
            if (value === ENCODER_RIGHT) {
                this.inSetParameter(this.inGetParameter() + this.parameterStep);
            } else if (value === ENCODER_LEFT) {
                this.inSetParameter(this.inGetParameter() - this.parameterStep);
            }
        },
        unshift: function() {
            this.inKey = "pregain";
            this.parameterStep = 0.025
        },
        shift: function() {
            this.inKey = "rate";
            this.parameterStep = - 0.005
        },
    });

    this.syncButton = new components.SyncButton({
        midiIn: [NOTE_ON, channelMapping.getControl('sync')],
        midiOut: [NOTE_ON, channelMapping.getControl('sync')],
    });

    this.cueButton = new components.CueButton({
        midiIn: [[NOTE_ON, channelMapping.getControl('cue')],[NOTE_OFF, channelMapping.getControl('cue')]],
        midiOut: [NOTE_ON, channelMapping.getControl('cue')],
    });

    this.playButton = new components.PlayButton({
        midiIn: [NOTE_ON, channelMapping.getControl('play')],
        midiOut: [NOTE_ON, channelMapping.getControl('play')]
    });

    this.pflOn = new components.Button({
        midiIn: [NOTE_ON, channelMapping.getControl('pfl')],
        inKey: 'pfl',
    });

    this.pflOff = new components.Button({
        midiIn: [NOTE_OFF, channelMapping.getControl('pfl')],
        inKey: 'pfl',
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
 * @param {AMXFV.globalMapping} mapping
 *   The global mapping object to fetch mapping for controls that are not related to a deck.
 */
AMXFV.DeckExtras = function (channelMapping, mapping) {
    components.Deck.call(this, channelMapping.getGroupNumber());

    this.playPosition = new components.Encoder({
        midiIn: [CONTROL_NUMBER, mapping.getControl('browseTurn')],
        inKey: "playposition",
        input: function (channel, control, value, status, group) {
            if (value === ENCODER_RIGHT) {
                this.inSetParameter(this.inGetParameter() + this.parameterStep);
            } else if (value === ENCODER_LEFT) {
                this.inSetParameter(this.inGetParameter() - this.parameterStep);
            }
        },
        unshift: function() {
            this.parameterStep = 0.007
        },
        shift: function() {
            this.parameterStep = 0.0002
        },
    });

    this.quantize = new components.Button({
        midiIn: [NOTE_ON, mapping.getControl('browseClick')],
        type: components.Button.prototype.types.toggle,
        unshift: function() {
            this.inKey = "quantize";
        },
        shift: function() {
            this.inKey = "keylock";
        },
    });

    this.beatloopSize = new components.Encoder({
        midiIn: [CONTROL_NUMBER, channelMapping.getControl('gain', leftDeckMapping.getIndex())],
        input: function (channel, control, value, status, group) {
            if (value === ENCODER_RIGHT) {
                this.inSetParameter(this.inGetParameter() * 2);
            } else if (value === ENCODER_LEFT) {
                this.inSetParameter(this.inGetParameter() / 2);
            }
        },
        inKey: "beatloop_size",
    });

    this.beatjumpSize = new components.Encoder({
        midiIn: [CONTROL_NUMBER, channelMapping.getControl('gain', rightDeckMapping.getIndex())],
        input: function (channel, control, value, status, group) {
            if (value === ENCODER_RIGHT) {
                this.inSetParameter(this.inGetParameter() * 2);
            } else if (value === ENCODER_LEFT) {
                this.inSetParameter(this.inGetParameter() / 2);
            }
        },
        inKey: "beatjump_size",
    });

    this.jumpBackButton = new components.Button({
        midiIn: [[NOTE_ON, channelMapping.getControl('load', leftDeckMapping.getIndex())], [NOTE_OFF, channelMapping.getControl('load', leftDeckMapping.getIndex())]],
        midiOut: [NOTE_ON, channelMapping.getControl('load', leftDeckMapping.getIndex())],
        inKey: 'beatjump_backward',
    });

    this.jumpFowardButton = new components.Button({
        midiIn: [[NOTE_ON, channelMapping.getControl('load', rightDeckMapping.getIndex())], [NOTE_OFF, channelMapping.getControl('load', rightDeckMapping.getIndex())]],
        midiOut: [NOTE_ON, channelMapping.getControl('load', rightDeckMapping.getIndex())],
        inKey: 'beatjump_forward',
    });

    this.loopActivate= new components.Button({
        midiIn: [NOTE_ON, channelMapping.getControl('sync', leftDeckMapping.getIndex())],
        inKey: "beatloop_activate",
    });

    this.reloop = new components.Button({
        midiIn: [[NOTE_ON, channelMapping.getControl('sync', rightDeckMapping.getIndex())], [NOTE_OFF, channelMapping.getControl('sync', rightDeckMapping.getIndex())]],
        inKey: "reloop_toggle",
    });

    this.loopIn= new components.Button({
        midiIn: [[NOTE_ON, channelMapping.getControl('cue', leftDeckMapping.getIndex())], [NOTE_OFF, channelMapping.getControl('cue', leftDeckMapping.getIndex())]],
        inKey: "loop_in",
    });

    this.loopOut = new components.Button({
        midiIn: [[NOTE_ON, channelMapping.getControl('cue', rightDeckMapping.getIndex())], [NOTE_OFF, channelMapping.getControl('cue', rightDeckMapping.getIndex())]],
        inKey: "loop_out"
    });

    this.rateTempDown = new components.Button({
        midiIn: [[NOTE_ON, channelMapping.getControl('play', leftDeckMapping.getIndex())], [NOTE_OFF, channelMapping.getControl('play', leftDeckMapping.getIndex())]],
        unshift: function() {
            this.inKey = "rate_temp_down";
        },
        shift: function() {
            this.inKey = "rate_temp_down_small";
        }
    });

    this.rateTempUp = new components.Button({
        midiIn: [[NOTE_ON, channelMapping.getControl('play', rightDeckMapping.getIndex())], [NOTE_OFF, channelMapping.getControl('play', rightDeckMapping.getIndex())]],
         unshift: function() {
            this.inKey = "rate_temp_up";
        },
        shift: function() {
            this.inKey = "rate_temp_up_small";
        }
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