// Import Modules
import {WarhammerItem} from "./items/item.js";
import {WarhammerActor} from "./actor.js";
import {WarhammerActorSheet} from "./actor-sheet.js";
import {getBaseToBaseDist, mmToInch, SYSTEM_ID} from "./constants.js";
import {preloadHandlebarsTemplates} from "./templates.js";
// import {WarhammerTokenDocument} from "./token.js";
import {WarhammerActorData} from "./warhammerActorData.js";
import {WeaponData} from "./items/weaponData.js";
import {WeaponTagData} from "./items/weaponTagData.js";
import {WarhammerAbilitySheet} from "./items/warhammer-ability-sheet.js";
import {WarhammerWeaponSheet} from "./items/warhammer-weapon-sheet.js";
import {WarhammerWTagSheet} from "./items/warhammer-wtag-sheet.js";
import {WarhammerRuler} from "./warhammerRuler.js";
import {WarhammerToken} from "./token.js";
import  "../libs/awesomplete/awesomplete.js"
/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
/**
 * Init hook.
 */
Hooks.once('init', function() {

    // Add utility classes to the global game object so that they're more easily
    // accessible in global contexts.
    game.warhammer = {
        WarhammerActor,
        WarhammerItem,
    };

    // Add custom constants for configuration.
    CONFIG.WARHAMMER = {};

    //define data models
    CONFIG.Actor.systemDataModels.model = WarhammerActorData;
    CONFIG.Item.systemDataModels.weapon = WeaponData;
    CONFIG.Item.systemDataModels.wtag = WeaponTagData;

    // Define custom Document classes
    CONFIG.Actor.documentClass = WarhammerActor;
    CONFIG.Item.documentClass = WarhammerItem;
    // CONFIG.Token.documentClass = WarhammerTokenDocument;

    // Register sheet application classes
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet(SYSTEM_ID, WarhammerActorSheet, { makeDefault: true });
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet(SYSTEM_ID, WarhammerAbilitySheet, { types: ["ability"], makeDefault: true });
    Items.registerSheet(SYSTEM_ID, WarhammerWeaponSheet, { types: ["weapon"], makeDefault: true });
    Items.registerSheet(SYSTEM_ID, WarhammerWTagSheet, { types: ["wtag"], makeDefault: true });

    game.settings.register(SYSTEM_ID, 'melee_generosity', {
        name: 'Melee Generosity',
        hint: "extra reach granted to melee weapons in inches",
        scope: 'world',     // "world" = sync to db, "client" = local storage
        config: true,       // false if you dont want it to show in module config
        type: Number,       // Number, Boolean, String, Object
        default: 0.1,
    });
    game.settings.register(SYSTEM_ID, "lastToggleState", {
        scope: "client",
        config: false,
        type: Boolean,
        default: true,
    });
    window.tokenRuler = {
        active: game.settings.get(SYSTEM_ID, "lastToggleState"),
        getBaseToBaseDist,
    };
    CONFIG.Canvas.rulerClass = WarhammerRuler;
    CONFIG.Token.objectClass = WarhammerToken;
    return preloadHandlebarsTemplates();
});

//turn tag string into array of tags
Hooks.on('preUpdateActor', function (actor, change, options, userid) {
        if (change?.system?.baseSize){
            if (!change.prototypeToken){
                change.prototypeToken = {height:0,width:0}
            }
            change.prototypeToken.height = mmToInch(change.system.baseSize) //convert mm to inches
            change.prototypeToken.width =  mmToInch(change.system.baseSize)
        }
})

//stolen from https://gitlab.com/tposney/midi-qol/-/blob/v11/src/module/chatMessageHandling.ts
Hooks.on('renderChatMessage', function (message, html, messageData) {
    let _highlighted= null;

    let _onTargetHover = (event) => {
        event.preventDefault();
        if (!canvas?.scene?.active) return;
        const token = canvas?.tokens?.get(event.currentTarget.id);
        if (token?.isVisible) {
            if (!token?._controlled) token._onHoverIn(event);
            _highlighted = token;
        }
    }

    /* -------------------------------------------- */

    /**
     * Handle mouse-unhover events for a combatant in the chat card
     * @private
     */
    let _onTargetHoverOut = (event) => {
        event.preventDefault();
        if (!canvas?.scene?.active) return;
        if (_highlighted) _highlighted._onHoverOut(event);
        _highlighted = null;
    }

    let _onTargetSelect = (event) => {
        event.preventDefault();
        if (!canvas?.scene?.active) return;
        const token = canvas.tokens?.get(event.currentTarget.id);
        token?.control({ multiSelect: false, releaseOthers: true });
    };


    let ids = html.find(".selectable-target-name")

    ids.hover(_onTargetHover, _onTargetHoverOut)
    ids.click(_onTargetSelect);
})


export let tokenRulerTool;
// Inject Terrain Ruler into the scene control buttons
Hooks.on("getSceneControlButtons", controls => {
    if (!tokenRulerTool) {
        tokenRulerTool = {
            name: "tokenRuler",
            title: "measure base-to-base",
            icon: "fas fa-circle-nodes",
            toggle: true,
            active: tokenRuler?.active,
            onClick: updateTokenRulerState,
            visible: true,
        }
    }
    const tokenControls = controls.find(group => group.name === "token").tools
    tokenControls.splice(tokenControls.findIndex(tool => tool.name === "ruler") + 1, 0, tokenRulerTool)
})

function updateTokenRulerState(newState) {
    tokenRuler.active = newState;
    game.settings.set(SYSTEM_ID, "lastToggleState", newState);
}

Hooks.on("renderActiveEffectConfig", function (application, html, data)  {
    let input = html.find(".key input")[0]
    console.log(Object.keys(flattenObject(application.object.parent.system)).map(s => "system."+s))
    new Awesomplete(input, {
        list: Object.keys(flattenObject(application.object.parent.system)).map(s => "system."+s)
    });
})