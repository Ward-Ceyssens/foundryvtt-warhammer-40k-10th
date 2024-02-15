import {getBaseToBaseDist, mmToInch, SYSTEM_ID} from "./constants.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class WarhammerActorSheet extends ActorSheet {
    /** @inheritdoc */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["warhammer", "sheet", "actor"],
            template: `systems/${SYSTEM_ID}/templates/actor-sheet.html`,
            width: 600,
            height: 650,
            // tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }]
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
            context.effects = this.actor.effects.contents
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
                    i.tagstring = '[' + i.items.map(x => {
                        let str = x.name
                        if (x.system.value)
                            str += " "+x.system.value
                        return str
                    } ).join(",") + ']';

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
        html.find('.effect-delete').click(ev => {
            const item = this.actor.effects.get(ev.currentTarget.dataset.itemid);
            item.delete();
            // li.slideUp(200, () => this.render(false));
        });
        // let handler = ev => this._onDragStart(ev);
        // Find all items on the character sheet.
        html.find('tr.item').each((i, tr) => {
            // Add draggable attribute and dragstart listener.
            tr.setAttribute("draggable", true);
            // tr.addEventListener("dragstart", handler, false);
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
        const system = duplicate(header.dataset);
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

        // Finally, create the item!
        if (type == "ActiveEffect")
            return ActiveEffect.create({
                label: name,
                type: type,
                system: system
            }, {parent: this.actor});

        return Item.create(itemData, {parent: this.actor});
    }

    //TODO recheck this later
    /**
     * Handle clickable rolls.
     * @param {Event} event   The originating click event
     * @private
     */
    async _onRoll(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const dataset = element.dataset;
        const weapon = this.actor.items.get(dataset.documentId)
        for (let tagid of weapon.system.tags) {
            if (!weapon.items)
                weapon.items = []
            let tag = this.actor.items.get(tagid)
            weapon.items.push(tag)
        }
        const targeted = game.user.targets;
        let controlled = this._inRange(canvas.tokens.controlled, targeted, weapon.system.range);

        //selected and targeted must make sense
        if (targeted.length == 0) {
            ui.notifications.error("Aborting Attack: No targets selected");
            return
        }
        for (const target of targeted) {
            if (!target.actor.equals(targeted.first().actor)) {
                ui.notifications.error("Aborting Attack: Targeting multiple actors with different stats");
                return
            }
        }

        if (canvas.tokens.controlled.length == 0) {
            ui.notifications.error("Aborting Attack: No tokens selected");
            return
        }
        if (controlled.length == 0) {
            ui.notifications.error("Aborting Attack: No tokens in range to attack target");
            return
        }

        //collect attackers
        controlled = controlled.filter( token => {
            for (const item of token.actor.items) {
                if (item.equals(weapon))
                    return true
            }
        })

        if (controlled.length == 0) {
            ui.notifications.error(`Aborting Attack: Cannot find ${weapon.name} among attackers`);
            return
        }
        let d = new Dialog({
            title: "Test Dialog",
            content: Handlebars.partials[`systems/${SYSTEM_ID}/templates/attackdialog.hbs`]({actor:this, weapon:weapon}),
            buttons: {
                one: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Continue",
                    callback: (html) => {
                        let modifiers = {
                            hitroll: parseInt(html.find('input[name=hitroll]')[0].value) || 0 ,
                            woundroll: parseInt(html.find('input[name=woundroll]')[0].value) || 0,
                            tags: $.map(html.find('input[name=optionaltags]:checked'),x => x.id)
                        }
                        this.fullAttack(controlled, targeted, weapon, modifiers)
                    }
                },
            },
        });
        d.render(true);
    }

    async fullAttack(controlled, targeted, weapon, modifiers) {
        //apply changes from dialog
        this.actor.system.modifiers.hitroll += modifiers.hitroll
        this.actor.system.modifiers.woundroll += modifiers.woundroll
        weapon.items = weapon.items.filter(x => !x.system.optional || modifiers.tags.includes(x._id))

        if (weapon.items.find(x => x.name.toUpperCase() == "IGNORES COVER"))
            this.actor.system.modifiers.grants.cover=false

        if (weapon.items.find(x => x.name.toUpperCase() == "LANCE"))
            this.actor.system.modifiers.woundroll+=1

        if (weapon.items.find(x => x.name.toUpperCase() == "INDIRECT FIRE")){
            this.actor.system.modifiers.hitroll-=1
            this.actor.system.modifiers.grants.cover=true
        }

        let completeAttackData = {
            models: controlled,
            targets: targeted,
            weapon: weapon,
            details: [],
            stats: {
                attacks: 0,
                hits: 0,
                wounds: 0,
                saves: 0,
                damage: 0,
            }
        }

        //par unit attack
        for (const model of controlled) {
            this._handleRapidFire(weapon, model, targeted)
            let roll = new Roll(weapon.system.attacks);
            await roll.evaluate({async: true});

            completeAttackData.stats.attacks += roll.total
            let singleUnitAttackData = {
                model: model,
                attacksRoll: roll.isDeterministic ? roll.total : await roll.render(),
                details: [],
                stats: {
                    attacks: roll.total,
                    hits: 0,
                    wounds: 0,
                    saves: 0,
                    damage: 0,
                }
            }
            //do attack
            for (let j = 0; j < roll.total; j++) {
                let results = await this._singleAttackRoll(model, weapon, targeted);
                singleUnitAttackData.details.push(await Promise.all(results.map(async roll => {
                    return roll.isDeterministic ? roll.total : await roll.render()
                })));
                if (results.length >= 2)
                    singleUnitAttackData.stats.hits++
                if (results.length >= 3)
                    singleUnitAttackData.stats.wounds++
                if (results.length >= 4) {
                    singleUnitAttackData.stats.saves++
                    singleUnitAttackData.stats.damage += results[results.length - 1].total
                }
            }
            completeAttackData.details.push(singleUnitAttackData)
            completeAttackData.stats.hits += singleUnitAttackData.stats.hits
            completeAttackData.stats.wounds += singleUnitAttackData.stats.wounds
            completeAttackData.stats.saves += singleUnitAttackData.stats.saves
            completeAttackData.stats.damage += singleUnitAttackData.stats.damage
        }

        this._toMessage(completeAttackData)
    }

    async _singleAttackRoll(model, weapon, target) {
        let results = []

        //hit
        let critHit = false
        if (weapon.items.find(x => x.name.toUpperCase() == "TORRENT")){
            results.push({render(){return "N/A"}})
        } else {
            let hitstr = `1d6`
            console.log(model.actor.system.modifiers)
            if (model.actor.system.modifiers.hitroll)
                hitstr += "+" + Math.max(-1, Math.min(1, (await (new Roll("0+"+model.actor.system.modifiers.hitroll)).evaluate({async: true})).total))
            let hroll = new Roll(hitstr);
            await hroll.evaluate({async: true});
            results.push(hroll)
            let hit = hroll.total >= weapon.system.skill
            if (hroll.dice.find(x => x.values.includes(0)))
                hit = false
            if (hroll.dice.find(x => x.values.includes(6))){
                hit = true
                critHit = true
            }
            if (!hit) {
                return results
            }
        }

        //wound
        if (critHit && weapon.items.find(x => x.name.toUpperCase() == "LETHAL HITS")){
            results.push({render(){return "N/A"}})
        } else {
            let woundstr = `1d6`
            if (model.actor.system.modifiers.woundroll)
                woundstr += "+" + Math.max(-1, Math.min(1, (await (new Roll("0+"+model.actor.system.modifiers.woundroll)).evaluate({async: true})).total))
            let successnum = this._woundMinRoll(weapon.system.strength, target.first().actor.system.stats.toughness)

            let wroll = new Roll(woundstr);
            await wroll.evaluate({async: true});
            let wound = wroll.total >= successnum
            if (!wound && weapon.items.find(x => x.name.toUpperCase() == "TWIN-LINKED")) {
                let tmp = wroll.dice[0].reroll("r<5", false)
                wroll = Roll.fromTerms(wroll.terms)
                wound = wroll.total >= successnum
            }
            results.push(wroll)
            if (wroll.dice.find(x => x.values.includes(0)))
                wound = false
            if (wroll.dice.find(x => x.values.includes(6)))
                wound = true
            if (!wound) {
                return results
            }
        }

        //save
        let sroll = new Roll(`1d6cs<${Math.max(2, Math.min(6, target.first().actor.system.stats.save - weapon.system.ap))}`);
        await sroll.evaluate({async: true});
        results.push(sroll)
        let save = sroll.total
        if (!save) {
            return results
        }

        //damage
        let droll = new Roll(weapon.system.damage);
        await droll.evaluate({async: true});
        results.push(droll)
        return results
    }

//TODO relative changes to number fields, requires turning them into textfields

    // _onNumberChange(event){
    //     const input = event.target;
    //     const value = input.value;
    //     if ( ["+", "-"].includes(value[0]) ) {
    //         console.log("DELTA")
    //         const delta = parseFloat(value);
    //         input.value = Number(foundry.utils.getProperty(this.actor, input.name)) + delta;
    //     }
    // }

    _inRange(controlled, targeted, range) {
        if (range == 0){
            return this._inMeleeRange(controlled, targeted)
        }
        return controlled.filter( token => {
            for (const target of targeted) {
                if (getBaseToBaseDist(token, target) <= range)
                    return true
            }
            return false
        })
    }

    _inMeleeRange(controlled, targeted) {
        //get all attackers that directly touch a target
        let firstPass = controlled.filter( token => {
            for (const target of targeted) {
                if (getBaseToBaseDist(token, target) <= game.settings.get(SYSTEM_ID, "melee_generosity"))
                    return true
            }
            return false
        })
        //get all attackers that directly touch the attackers from firstpass
        //because they touch themselves this includes every attacker from firstpass too
        let secondPass = controlled.filter( token => {
            for (const target of firstPass) {
                if (getBaseToBaseDist(token, target) <= game.settings.get(SYSTEM_ID, "melee_generosity"))
                    return true
            }
            return false
        })
        return secondPass;
    }

    _woundMinRoll(strength, toughness){
        if (strength >= toughness*2)
            return 2
        if (strength > toughness)
            return 3
        if (strength == toughness)
            return 4
        if (strength*2 <= toughness)
            return 6
        return 5
    }

    async _toMessage(data, messageData={}, {rollMode, create=true}={}) {

        let attackers = data.models.reduce((acc, val) => {
            val = val.actor.name
            acc[val] = acc[val] === undefined ? 1 : acc[val] += 1;
            return acc;
        }, {});
        let targets = data.targets.reduce((acc, val) => {
            val = val.actor.name
            acc[val] = acc[val] === undefined ? 1 : acc[val] += 1;
            return acc;
        }, {});

        data.models = []

        for (const attacker in attackers) {
            data.models.push({
                name: attacker,
                num: attackers[attacker],
            })
        }
        data.targets = []
        for (const target in targets) {
            data.targets.push({
                name: target,
                num: targets[target],
            })
        }

        let html = Handlebars.partials[`systems/${SYSTEM_ID}/templates/chatmessage.hbs`](data)

        // Prepare chat data
        messageData = foundry.utils.mergeObject({
            speaker: ChatMessage.getSpeaker(),
            content: html,
            user: game.user.id,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            sound: CONFIG.sounds.dice
        }, messageData);

        // Either create the message or just return the chat data
        const cls = getDocumentClass("ChatMessage");
        const msg = new cls(messageData);
        // Either create or return the data
        if ( create ) return cls.create(msg.toObject(), { rollMode });
        else {
            if ( rollMode ) msg.applyRollMode(rollMode);
            return msg.toObject();
        }
    }

    _handleRapidFire(weapon, model, targeted) {
        let rapidfire = weapon.items.find(x => x.name.toUpperCase() == "RAPID FIRE")
        if (!rapidfire || !rapidfire.system.value)
            return
        for (const target of targeted) {
                if (getBaseToBaseDist(model, target) <= weapon.system.range/2){
                    weapon.system.attacks += '+'+rapidfire.system.value
                    return
                }
            }
    }
}
