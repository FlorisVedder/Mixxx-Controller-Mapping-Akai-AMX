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
 * Central object to store midi mapping values.
 *
 * Not required but makes code readable, reusable, more generic and maintainable.
 * Instead of using the hex values hardcoded in the script.
 */
AMXFV.layout = {
    'shift': 0x00,
    'sync': [0x06, 0x07],
    'cue': [0x08, 0x09],
    'play': [0x0A, 0x0B],
    'eqTrebleLSB': [0x0A, 0x0E],
    'eqTrebleMSB': [0x2A, 0x2E],
    'eqMidLSB': [0x09, 0x0D],
    'eqMidMSB': [0x29, 0x2E],
    'eqBassLSB': [0x08, 0x0C],
    'eqBassMSB': [0x28, 0x2C],
    'lineFaderLSB': [0x07, 0x0B],
    'lineFaderMSB': [0x27, 0x2B],
    'crossfader': 0x21,
};

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
    this.global = new AMXFV.Global();

    this.leftDeck = new AMXFV.Deck(0, 1);
    this.rightDeck = new AMXFV.Deck(1, 2);

    this.global.shiftButton.registerComponent(this.leftDeck);
    this.global.shiftButton.registerComponent(this.rightDeck);

};

/**
 * Required Mixxx shutdown function.
 *
 * @see https://github.com/mixxxdj/mixxx/wiki/Midi-Scripting#script-file-header
 */
AMXFV.shutdown = function () {
    this.leftDeck.shutdown();
    this.rightDeck.shutdown();
};

////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*       Components JS implementation for a Global container        *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////

/**
 * Global constructor
 *
 * To place global components not related to mixxx controls, eg the shift button.
 */


AMXFV.Global = function() {

        this.shiftButton = new AMXFV.ShiftButton({
            midiIn: [[NOTE_ON, AMXFV.layout.shift], [NOTE_OFF, AMXFV.layout.shift]],
        });

        this.reconnectComponents(function (component) {
            if (component.group === undefined) {
                component.group = "[Global]";
            }
        });

};
AMXFV.Global.prototype = new components.ComponentContainer();



////////////////////////////////////////////////////////////////////////
//*                                                                  *//
//*             Components JS implementation for a Deck              *//
//*                                                                  *//
////////////////////////////////////////////////////////////////////////

/**
 * Deck constructor
 *
 * @param controllerIndex
 *   The index that references to the mapping in AMXFV.controller.layout
 * @param deckNumber
 *   Referring to the deck number (also control group number) in Mixxx.
 */
AMXFV.Deck = function (controllerIndex, deckNumber) {
    components.Deck.call(this, deckNumber);

    this.syncButton = new components.SyncButton({
        midiIn: [NOTE_ON, AMXFV.layout.sync[controllerIndex]],
        midiOut: [NOTE_ON, AMXFV.layout.sync[controllerIndex]],
    });

    this.playButton = new components.PlayButton({
        midiIn: [NOTE_ON, AMXFV.layout.play[controllerIndex]],
        midiOut: [NOTE_ON, AMXFV.layout.play[controllerIndex]]
    });

    this.equalizerRack = new AMXFV.EqualizerRack(controllerIndex, deckNumber, 1);

    this.lineFader = new components.Pot({
        midiIn: [[CONTROL_NUMBER, AMXFV.layout.lineFaderLSB[controllerIndex]], [CONTROL_NUMBER, AMXFV.layout.lineFaderMSB[controllerIndex]]],
        inKey: 'volume'
    });

    // Connect all components of this deck to the same control group.
    this.reconnectComponents(function (component) {
        if (component.group === undefined) {
            component.group = this.currentDeck;
        }
    });
};
AMXFV.Deck.prototype = new components.Deck([]);


/**
 * Equalizer rack constructor
 *
 * @param controllerIndex
 *   The index that references to the mapping in AMXFV.controller.layout
 * @param deckNumber
 *   Referring to the deck number (also control group number) in Mixxx.
 * @param rackNumber
 *   Number of the equalizer rack.
 */
AMXFV.EqualizerRack = function(controllerIndex, deckNumber, rackNumber) {

    this.filterHigh = new components.Pot({
        midiIn: [[CONTROL_NUMBER, AMXFV.layout.eqTrebleLSB[controllerIndex]], [CONTROL_NUMBER, AMXFV.layout.eqTrebleMSB[controllerIndex]]],
        inKey: `parameter3`
    });

    this.filterMid = new components.Pot({
        midiIn: [[CONTROL_NUMBER, AMXFV.layout.eqMidLSB[controllerIndex]], [CONTROL_NUMBER, AMXFV.layout.eqMidMSB[controllerIndex]]],
        inKey: 'parameter2'
    });

    this.filterLow = new components.Pot({
        midiIn: [[CONTROL_NUMBER, AMXFV.layout.eqBassLSB[controllerIndex]], [CONTROL_NUMBER, AMXFV.layout.eqBassMSB[controllerIndex]]],
        inKey: 'parameter1'
    });

    this.reconnectComponents(function (component) {
        if (component.group === undefined) {
            component.group = `[EqualizerRack${rackNumber}_[Channel${deckNumber}]_Effect1]`;
        }
    });

};
AMXFV.EqualizerRack.prototype = new components.ComponentContainer();

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

    var componentCollection = [];
    function ShiftButton(options) {
        components.Button.call(this, options);

        this.registerComponent = function (component) {
            if (component instanceof components.Component || component instanceof components.ComponentContainer) {
                componentCollection.push(component);
                return;
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
