// Import Modules
import {WarhammerItem} from "./items/item.js";
import {WarhammerActor} from "./actors/actor.js";
import {WarhammerModelSheet} from "./actors/actor-sheet.js";
import {getBaseToBaseDist, mmToInch, SYSTEM_ID} from "./constants.js";
import {preloadHandlebarsTemplates} from "./templates.js";
// import {WarhammerTokenDocument} from "./token.js";
import {WarhammerModelData} from "./actors/warhammerModelData.js";
import {WeaponData} from "./items/weaponData.js";
import {WeaponTagData} from "./items/weaponTagData.js";
import {WarhammerAbilitySheet} from "./items/warhammer-ability-sheet.js";
import {WarhammerWeaponSheet} from "./items/warhammer-weapon-sheet.js";
import {WarhammerWTagSheet} from "./items/warhammer-wtag-sheet.js";
import {WarhammerRuler} from "./warhammerRuler.js";
import {WarhammerToken} from "./token.js";
import "../libs/awesomplete/awesomplete.js"
import {WarhammerObjectiveData} from "./actors/warhammerObjectiveData.js";
import {WarhammerObjectiveSheet} from "./actors/objective-sheet.js";
import {RosterImporter} from "./importer.js";
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
    CONFIG.Actor.dataModels.model = WarhammerModelData;
    CONFIG.Actor.dataModels.objective = WarhammerObjectiveData;
    CONFIG.Item.dataModels.weapon = WeaponData;
    CONFIG.Item.dataModels.wtag = WeaponTagData;

    // Define custom Document classes
    CONFIG.Actor.documentClass = WarhammerActor;
    CONFIG.Item.documentClass = WarhammerItem;
    // CONFIG.Token.documentClass = WarhammerTokenDocument;
    CONFIG.Combat.initiative = {
        formula: '1d6',
        decimals: 2,
    };    // Register sheet application classes
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet(SYSTEM_ID, WarhammerModelSheet, { types: ["model"], makeDefault: true });
    Actors.registerSheet(SYSTEM_ID, WarhammerObjectiveSheet, { types: ["objective"], makeDefault: true });
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
Hooks.on('preCreateActor', function (actor, data, options, userid) {
    actor.updateSource({
        prototypeToken: {
            height: mmToInch(actor.system.baseSize),
            width: mmToInch(actor.system.baseSize),
        }
    })
    if (actor.type == "objective"){
        actor.updateSource({
            img: "icons/svg/target.svg",
            prototypeToken: {
                displayName: 30,
                texture: {
                    src: "icons/svg/target.svg",
                    tint: "#000000",
                }
            }
        })
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
    let inputs = html.find(".key input")
    $.map( inputs, input => {
        new Awesomplete(input, {
            list: Object.keys(flattenObject(application.object.parent.system)).map(s => "system."+s)
        });
    })
})

//TODO: make this hook onto the end of any token move instead
Hooks.on("sightRefresh", ()=> {
    let objectives = canvas.tokens.placeables.filter(x => x.actor?.type === "objective")
    objectives.map(x => x.actor.updateObjective(x))
})


Hooks.once("dragRuler.ready", (SpeedProvider) => {
    class WarhammerSpeedProvider extends SpeedProvider {
        get colors() {
            return [
                {id: "move", default: 0x00FF00, name: "NORMAL MOVE"},
            ]
        }

        getRanges(token) {
            if (token.actor.type === "objective")
                return []

            const baseSpeed = token.actor.system.stats.move

            return [
                {range: baseSpeed, color: "move"},
            ]
        }
    }

    dragRuler.registerSystem(SYSTEM_ID, WarhammerSpeedProvider)
})

Hooks.on('renderActorDirectory', (app, html, data) => {

    //return early if user isn't a gm (and thus can't create folders, which the importer does)
    if (!game.user.isGM)
        return

    html.find('div.action-buttons').append("<button class='import-roster'><i class=\"fas fa-file-import\"></i>Import Roster</button>");
    let d = new Dialog({
        title: "Roster Import",
        content: "<form autocomplete=\"off\" onsubmit=\"event.preventDefault();\">\n" +
            "    <p class=\"notes\">You may import a roster in the .ros format</p>\n" +
            "    <div class=\"form-group\">\n" +
            "        <label for=\"data\">Roster File</label>\n" +
            "        <input type=\"file\" name=\"data\" accept='.ros'/>\n" +
            "    </div>\n",
        buttons: {
            import: {
                icon: "<i class=\"fas fa-file-import\"></i>",
                label: "Import",
                cssClass: "import default",
                callback: html => {
                    const form = html.find("form")[0];
                    if ( !form.data.files.length ) return ui.notifications.error("You did not upload a data file!");
                    readTextFromFile(form.data.files[0]).then(rosterXML => RosterImporter.import(rosterXML));
                }
            },
            no: {
                icon: "<i class=\"fas fa-times\"></i>",
                label: "Cancel",
                cssClass: "no"
            }
        }
    })

    html.find('.import-roster').click(()=>{
        d.render(true)})
});