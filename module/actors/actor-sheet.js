import {FACTIONS, getBaseToBaseDist, mmToInch, SYSTEM_ID} from "../constants.js";
import {WarhammerActor} from "./actor.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class WarhammerModelSheet extends ActorSheet {
    /** @inheritdoc */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["warhammer", "sheet", "actor"],
            template: `systems/${SYSTEM_ID}/templates/actor-sheet.html`,
            width: 600,
            height: 650,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "weapons" }],
            dragDrop: [{ dragSelector: 'tr.item', dropSelector: '.sheet-body' }],

        });
    }
    /* -------------------------------------------- */
    /** @inheritdoc */
    async getData() {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        const context = super.getData();
        context.SYSTEM_ID = SYSTEM_ID
        context.FACTIONS = FACTIONS
        let factionSelectOptions = []
        for (const key in FACTIONS) {
            factionSelectOptions.push({key:key, value: key});
        }
        context.factionSelectOptions = factionSelectOptions
        // Use a safe clone of the actor data for further operations.
        const actorData = context.actor.system;

        // Add the actor's data to context.data for easier access, as well as flags.
        context.system = actorData;
        context.flags = actorData.flags;

        // Add roll data for TinyMCE editors.
        context.rollData = context.actor.getRollData();

        // Prepare character data and items.
        if (context.actor.type == 'model') {
            this._prepareItems(context);

            // Prepare active effects
            let effects = {
                inactive: [],
                temporary: [],
                passive: [],
            }
            for (let e of this.actor.effects.contents) {
                if (e.disabled) effects.inactive.push(e);
                else if (e.isTemporary) effects.temporary.push(e);
                else effects.passive.push(e);
            }
            context.effects = effects
        }

        // Add roll data for TinyMCE editors.
        context.rollData = context.actor.getRollData();
        context.enriched = {};
        context.enriched.biography = await TextEditor.enrichHTML(actorData.biography, {async: true})

        // context.CONFIG = CONFIG
        return context;
    }

    /**
     * Organize and classify Items for Character sheets.
     *
     * @param {Object} actorData The actor to prepare.
     *
     * @return {undefined}
     */
    _prepareItems(context) {
        // Initialize containers.
        let weapons ={
            melee:[],
            ranged: []
        }
        let abil= []

        // Iterate through items, allocating to containers
        for (let i of context.items) {
            if (i.type === 'weapon') {
                for (let tagid of i.system.tags) {
                    if (!i.items)
                        i.items = []
                    let tag = this.actor.items.get(tagid)
                    i.items.push(tag)
                }
                if (i.items)
                    i.tagstring = this.actor.items.get(i._id).getTagstring();

                if (i.system.range == 0)
                    weapons.melee.push(i)
                else
                    weapons.ranged.push(i)
            }
            if (i.type === 'ability')
                abil.push(i)
        }
        // Assign and return
        context.items.weapons = weapons;
        context.items.abil = abil;

    }

    /** @override */
    activateListeners(html) {
        html[0].style.setProperty(`--faction-color`, FACTIONS[this.actor.system.faction].color);
        if (this.actor.system.invulnsave)
            html[0].style.setProperty(`--header-height`, "170px");

        // Render the item sheet for viewing/editing prior to the editable check.
        html.find('.item-edit').click(ev => {
            const item = this.actor.items.get(ev.currentTarget.dataset.itemid);
            item.sheet.render(true);
        });
        html.find('.effect-edit').click(ev => {
            const item = this.actor.effects.get(ev.currentTarget.dataset.itemid);
            item.sheet.render(true);
        });
        html.find('.rollable').click(this._onRoll.bind(this));

        // -------------------------------------------------------------
        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        // Add Inventory Item
        html.find('.item-create').click(this._onItemCreate.bind(this));

        // Delete Inventory Item
        html.find('.item-delete').click(ev => {
            const item = this.actor.items.get(ev.currentTarget.dataset.itemid);
            item.delete();
            // li.slideUp(200, () => this.render(false));
        });

        html.find('.effect-create').click(this._onEffectCreate.bind(this));
        html.find('.effect-enable').click(ev => {
            ActiveEffect.updateDocuments([{_id: ev.currentTarget.dataset.itemid, disabled: false}], {parent: this.actor})
        });
        html.find('.effect-disable').click(ev => {
            ActiveEffect.updateDocuments([{_id: ev.currentTarget.dataset.itemid, disabled: true}], {parent: this.actor})
        });
        html.find('.effect-delete').click(ev => {
            const item = this.actor.effects.get(ev.currentTarget.dataset.itemid);
            item.delete();
            // li.slideUp(200, () => this.render(false));
        });

        super.activateListeners(html);
    }
    /* -------------------------------------------- */

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    async _onItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        // Get the type of item to create.
        const type = header.dataset.type;
        // Grab any data associated with this control.
        const system = foundy.utils.duplicate(header.dataset);
        // Initialize a default name.
        const name = `New ${type.capitalize()}`;
        // Prepare the item object.
        const itemData = {
            name: name,
            type: type,
            system: system
        };
        // Remove the type from the dataset since it's in the itemData.type prop.
        delete itemData.system["type"];

        return Item.create(itemData, {parent: this.actor});
    }
    async _onEffectCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        // Get the type of item to create.
        const type = header.dataset.type;
        // Grab any data associated with this control.
        const system = duplicate(header.dataset);
        // Initialize a default name.
        const name = `New ${type.capitalize()} Effect`;
        // Prepare the item object.
        const itemData = {
            name: name,
            system: system
        };
        if (type === "temporary")
            itemData.duration = {seconds: 60}
        if (type === "inactive")
            itemData.disabled = true
        // Remove the type from the dataset since it's in the itemData.type prop.
        delete itemData.system["type"];

        return ActiveEffect.create(itemData, {parent: this.actor});
    }
    //TODO recheck this later
    /**
     * Handle clickable rolls.
     * @param {Event} event   The originating click event
     * @private
     */
    async _onRoll(event) {
        event.preventDefault();
        let controlled = canvas.tokens.controlled

        //add sheets token if nothing else is selected
        if (controlled.length === 0 && this.actor.token?._object) {
            controlled.push(this.actor.token._object)
        }
        if (controlled.length === 0) {
            ui.notifications.error("Aborting Attack: No tokens selected");
            return
        }
        const element = event.currentTarget;
        const dataset = element.dataset;
        //TODO find a less stupid way to clone: deepClone(doesn't clone) and duplicate(doesn't copy modified values) don't work
        const weapon = this.actor.items.get(dataset.documentId)
        let weaponData = foundry.utils.expandObject(foundry.utils.flattenObject(weapon.system))
        weaponData.name = weapon.name
        let actorData = foundry.utils.expandObject(foundry.utils.flattenObject(this.actor.system))

        weaponData.items = []
        for (let tagid of weapon.system.tags) {
            let tag = this.actor.items.get(tagid)
            weaponData.items.push(tag)
        }
        weaponData.tagstring = weapon.getTagstring()

        const targeted = game.user.targets;


        //selected and targeted must make sense
        if (targeted.length === 0) {
            ui.notifications.error("Aborting Attack: No targets selected");
            return
        }

        for (const target of targeted) {
            //actor could be null if the token is linked to a deleted actor, or the link was otherwise broken
            if (!target.actor){
                ui.notifications.error("Aborting Attack: Targeting token with invalid actor");
                return
            }
            if (!target.actor.equals(targeted.first().actor)) {
                ui.notifications.error("Aborting Attack: Targeting multiple actors with different stats");
                return
            }
        }

        //filter attackers: has weapon?
        let tmp = controlled.filter( token => {
            for (const item of token.actor.items) {
                if (item.equals(weapon))
                    return true
            }
        })
        let noWeapon = controlled.filter(x => !tmp.includes(x));
        controlled = tmp

        if (controlled.length === 0) {
            ui.notifications.error(`Aborting Attack: Cannot find ${weapon.name} among selected tokens`);
            return
        }

        //filter attackers: in range?
        tmp = weapon._inRange(controlled, targeted, weapon.system.range);
        let outOfRange = controlled.filter(x => !tmp.includes(x));
        controlled = tmp

        if (controlled.length === 0) {
            ui.notifications.error("Aborting Attack: No tokens in range to attack target");
            return
        }

        let hitrollBonus;
        if (weaponData.range !== 0){
            hitrollBonus = targeted.first().actor.system.modifiers.grants.hitroll.ranged.bonus || this.actor.system.modifiers.hitroll.ranged.bonus
        } else {
            hitrollBonus = targeted.first().actor.system.modifiers.grants.hitroll.melee.bonus || this.actor.system.modifiers.hitroll.melee.bonus
        }
        let woundrollBonus = targeted.first().actor.system.modifiers.grants.woundroll.bonus || this.actor.system.modifiers.woundroll.bonus

        let dialogHtml = Handlebars.partials[`systems/${SYSTEM_ID}/templates/attackdialog.hbs`]({
            actor:this.actor,
            shouldOverwatch:game.combat != null && this.actor.system.faction !== game.combat?.combatant?.actor.system.faction,
            weapon:weaponData,
            target:targeted.first(),
            models: WarhammerActor.reduceToCount(controlled),
            targets: WarhammerActor.reduceToCount(targeted),
            hitrollBonus:hitrollBonus,
            woundrollBonus:woundrollBonus,
            dropped:{
                attackers: {
                    display: outOfRange?.length || noWeapon?.length,
                    range:WarhammerActor.reduceToCount(outOfRange),
                    weapon: WarhammerActor.reduceToCount(noWeapon),
                }
            }
        })
        let d = new Dialog({
            title: "Attack Dialog",
            content: dialogHtml,
            buttons: {
                one: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Continue",
                    callback: (html) => {
                        let modifiers = {
                            hitroll: parseInt(html.find('input[name=hitroll]')[0].value) || 0 ,
                            woundroll: parseInt(html.find('input[name=woundroll]')[0].value) || 0,
                            cover: $.map(html.find('input[name=cover]:checked'),x => x.checked)[0],
                            tags: $.map(html.find('input[name=optionaltags]:checked'),x => x.id),
                            overwatch: $.map(html.find('input[name=overwatch]:checked'),x => x.checked)[0],
                            overwatchValue: Math.max(Math.min(parseInt(html.find('input[name=overwatch-value]')[0].value) || 0, 6), 1),
                        }
                        weapon.fullAttack(controlled, targeted, weaponData, actorData, modifiers)
                    }
                },
            },

        });
        d.render(true);
    }



    async _onDrop(event) {
        if (!event.dataTransfer.getData("text/plain"))
            return
        let data = await fromUuid(JSON.parse(event.dataTransfer.getData("text/plain")).uuid)

        //allow normal drop for anything else
        if (data.type !== 'wtag'){
            super._onDrop(event)
            return
        }

        let target = event.target.closest(".item")?.dataset.documentId
        if (!target)
            return

        target = this.actor.items.get(target)

        if (target.type !== 'weapon')
            return

        const itemData = {
            name: data.name,
            type: data.type,
            system: data.system
        };

        let newTag = await Item.create(itemData, {parent: this.actor});
        let newTagList = target.system.tags
        newTagList.push(newTag._id)
        await target.update({
            "system.tags": newTagList
        })
        this.render(true)
    }

    _onDragStart(event){
        let type = event.target.closest(".item")?.dataset.type
        let data
        switch (type) {

            case "Item":
            data = {
                type: 'Item',
                uuid: this.actor.items.get(event.target.closest(".item")?.dataset.documentId).uuid,
            }
            break

            case "ActiveEffect":
            data = {
                type: 'ActiveEffect',
                uuid: this.actor.effects.get(event.target.closest(".item")?.dataset.documentId).uuid,
            }

        }
        event.dataTransfer.setData("text/plain", JSON.stringify(data))
    }
}
