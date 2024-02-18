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
        //TODO use safe clones instead of editing actual item
        const weapon = this.actor.items.get(dataset.documentId)
        let weaponData = duplicate(weapon.system)
        weaponData.name = weapon.name
        let actorData = duplicate(this.actor.system)
        actorData.tags = duplicate(this.actor.system.tags) //because fuck js

        for (let tagid of weapon.system.tags) {
            if (!weaponData.items)
                weaponData.items = []
            let tag = this.actor.items.get(tagid)
            weaponData.items.push(tag)
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
            content: Handlebars.partials[`systems/${SYSTEM_ID}/templates/attackdialog.hbs`]({actor:this, weapon:weaponData, target:targeted.first()}),
            buttons: {
                one: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Continue",
                    callback: (html) => {
                        let modifiers = {
                            hitroll: parseInt(html.find('input[name=hitroll]')[0].value) || 0 ,
                            woundroll: parseInt(html.find('input[name=woundroll]')[0].value) || 0,
                            cover: $.map(html.find('input[name=cover]:checked'),x => x.checked)[0],
                            tags: $.map(html.find('input[name=optionaltags]:checked'),x => x.id)
                        }
                        this.fullAttack(controlled, targeted, weaponData, actorData, modifiers)
                    }
                },
            },
        });
        d.render(true);
    }

    async fullAttack(controlled, targeted, weaponData, actorData, modifiers) {
        let targetData = duplicate(targeted.first().actor.system)
        targetData.tags = duplicate(targeted.first().actor.system.tags)
        //apply changes from dialog
        actorData.modifiers.hitroll += modifiers.hitroll
        actorData.modifiers.woundroll += modifiers.woundroll
        actorData.modifiers.grants.cover |= modifiers.cover
        weaponData.items = weaponData.items.filter(x => !x.system.optional || modifiers.tags.includes(x._id))
        if (weaponData.items.find(x => x.name.toUpperCase() == "IGNORES COVER"))
            actorData.modifiers.grants.cover=false

        if (weaponData.items.find(x => x.name.toUpperCase() == "LANCE"))
            actorData.modifiers.woundroll+=1

        //apply .grants to targetData
        for (const actorDataKey in actorData.modifiers.grants) {
            targetData.modifiers[actorDataKey] = actorData.modifiers.grants[actorDataKey]
        }
        let completeAttackData = {
            models: controlled,
            targets: targeted,
            weapon: weaponData,
            details: [],
            stats: {
                attacks: 0,
                hits: 0,
                wounds: 0,
                saves: 0,
                damage: 0,
            },
            hazardous: {
                destroyed: 0,
                wounded: 0,
            },
        }
        //par unit attack
        for (const model of controlled) {
            let bonusattacks = ""
            if (weaponData.items.find(x => x.name.toUpperCase() == "RAPID FIRE"))
                bonusattacks += "+" + this._handleRapidFire(weaponData, model, targeted)
            if (weaponData.items.find(x => x.name.toUpperCase() == "BLAST"))
                bonusattacks += "+" + Math.floor(targeted.size/5)

            let roll = new Roll(weaponData.attacks + bonusattacks);
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
                },
                hazardousHtml: null,
            }
            //do attack
            for (let j = 0; j < roll.total; j++) {
                let results = await this._singleAttackRoll(model, duplicate(weaponData), duplicate(actorData), duplicate(targetData), targeted);
                // singleUnitAttackData.details.push(await Promise.all(results.map(async roll => {
                //     return roll.isDeterministic ? roll.total : await roll.render()
                // })));

                //update stats
                singleUnitAttackData.stats.hits += results.hits
                singleUnitAttackData.stats.wounds+= results.rest.reduce((previousValue, currentValue) => previousValue + Boolean(currentValue.wound), 0)
                singleUnitAttackData.stats.saves+= results.rest.reduce((previousValue, currentValue) => previousValue + Boolean(currentValue.save), 0)
                singleUnitAttackData.stats.damage+= results.rest.reduce((previousValue, currentValue) => previousValue + currentValue.damage?.total || 0, 0)

                //render html
                results.hitroll = results.hitroll.isDeterministic ? results.hitroll.total : await results.hitroll.render()
                for (const restItem of results.rest) {
                    restItem.wound = restItem.wound?.isDeterministic ? restItem.wound.total : await restItem.wound?.render()
                    restItem.save = restItem.save?.isDeterministic ? restItem.save.total : await restItem.save?.render()
                    restItem.damage = restItem.damage?.isDeterministic ? restItem.damage?.total : await restItem.damage?.render()
                }
                singleUnitAttackData.details.push(results)
            }
            completeAttackData.details.push(singleUnitAttackData)
            completeAttackData.stats.hits += singleUnitAttackData.stats.hits
            completeAttackData.stats.wounds += singleUnitAttackData.stats.wounds
            completeAttackData.stats.saves += singleUnitAttackData.stats.saves
            completeAttackData.stats.damage += singleUnitAttackData.stats.damage

            if (weaponData.items.find(x => x.name.toUpperCase() == "HAZARDOUS")){
                singleUnitAttackData.hazardousHtml = "Hazardous check:"
                let roll = new Roll('1d6');
                await roll.evaluate({async: true});
                singleUnitAttackData.hazardousHtml += await roll.render()
                if (roll.total === 1){
                    if (actorData.tags.some( x => ["CHARACTER", "MONSTER", "VEHICLE"].includes(x.toUpperCase()))) {
                        singleUnitAttackData.hazardousHtml += "take 3 mortal wounds"
                        completeAttackData.hazardous.wounded+=1
                    } else {
                        singleUnitAttackData.hazardousHtml += "unit destroyed"
                        completeAttackData.hazardous.destroyed+=1
                    }
                }
            }

        }
        this._toMessage(completeAttackData)
    }

    async _singleAttackRoll(model, weaponData, actorData, targetData, targets) {
        if (weaponData.items.find(x => x.name.toUpperCase() == "INDIRECT FIRE")
            //check if we can target anyone normally (visible to given token)
            && !targets.some((target) => model.los.contains(target.center.x, target.center.y) && getBaseToBaseDist(model, target) <= weaponData.range)){
            actorData.modifiers.hitroll-=1
            targetData.modifiers.cover=true
        }
        let result = {
            hitroll: "",
            hits: 0,
            rest: []
        }

        //hit
        let critHit = false
        if (weaponData.items.find(x => x.name.toUpperCase() == "TORRENT")){
            result.hitroll = {render(){return "N/A"}}
        } else {
            let hitstr = `1d6`
            if (weaponData.items.find(x => x.name.toUpperCase() == "HEAVY"))
                actorData.modifiers.hitroll += 1
            if (actorData.modifiers.hitroll)
                hitstr += "+" + Math.max(-1, Math.min(1, actorData.modifiers.hitroll))


            let hroll = new Roll(hitstr);
            await hroll.evaluate({async: true});
            result.hitroll= hroll
            let hit = hroll.total >= weaponData.skill
            if (hroll.dice.find(x => x.values.includes(1)))
                hit = false
            if (hroll.dice.find(x => x.values.includes(6))){
                hit = true
                critHit = true
            }
            if (!hit) {
                return result
            }
        }
        let numhits = 1
        if (critHit && weaponData.items.find(x => x.name.toUpperCase() == "SUSTAINED HITS")){
            numhits += parseInt(weaponData.items.find(x => x.name.toUpperCase() == "SUSTAINED HITS").system.value) || 0
        }
        result.hits = numhits
        for (let i = 0; i < numhits; i++) {
            let subresult = {
                // wound: "",
                // save: "",
                // damage: "",
            }
            result.rest.push(subresult)

            //wound
            let critWound = false
            if (critHit && weaponData.items.find(x => x.name.toUpperCase() == "LETHAL HITS")) {
                subresult.wound = {
                    render() {
                        return "N/A"
                    }
                }
            } else {
                let woundstr = `1d6`
                if (actorData.modifiers.woundroll)
                    woundstr += "+" + Math.max(-1, Math.min(1, (await (new Roll("0+" + actorData.modifiers.woundroll)).evaluate({async: true})).total))
                let successnum = this._woundMinRoll(weaponData.strength, targetData.stats.toughness)

                let wroll = new Roll(woundstr);
                await wroll.evaluate({async: true});
                let wound = wroll.total >= successnum
                if (!wound && weaponData.items.find(x => x.name.toUpperCase() == "TWIN-LINKED")) {
                    let tmp = wroll.dice[0].reroll("r<5", false)
                    wroll = Roll.fromTerms(wroll.terms)
                    wound = wroll.total >= successnum
                }
                subresult.wound = wroll
                if (wroll.dice.find(x => x.values.includes(1)))
                    wound = false
                if (wroll.dice.find(x => x.values.includes(6))) {
                    wound = true
                    critWound = true
                }
                if (weaponData.items.find(x => x.name.toUpperCase().startsWith("ANTI-"))) {
                    let anti= weaponData.items.find(x => x.name.toUpperCase().startsWith("ANTI-"))
                    let targettag = anti.name.split("-")[1]
                    if (wroll.dice.find(x => x.values.some( y => y>=parseInt(anti.system.value)))
                        && targetData.tags.map(x => x.toUpperCase()).includes(targettag.toUpperCase())){
                        wound = true
                        critWound = true
                    }
                }
                if (!wound) {
                    continue
                }
            }

            //save
            if (critWound && weaponData.items.find(x => x.name.toUpperCase() == "DEVASTATING WOUNDS")) {
                subresult.save = {
                    render() {
                        return "N/A"
                    }
                }
            } else {
                let savemod = "+" + weaponData.ap

                //cover
                if (targetData.modifiers.cover &&
                    !(targetData.stats.save >= 3 && weaponData.ap === 0))
                    savemod += "+1"
                let modifiedSavestat = targetData.stats.save - (await (new Roll(savemod)).evaluate({async: true})).total

                let savetarget = targetData.stats.save
                if (modifiedSavestat > targetData.invulnsave)
                    savetarget = targetData.invulnsave

                let sroll = new Roll(`1d6` + savemod);
                await sroll.evaluate({async: true});
                subresult.save = sroll
                let save = sroll.total < savetarget
                if (sroll.dice.find(x => x.values.includes(1)))
                    save = true
                if (!save) {
                    continue
                }
            }

            //damage
            let bonusdamage = ""
            if (weaponData.items.find(x => x.name.toUpperCase() == "MELTA"))
                bonusdamage += "+" + this._handleMelta(weaponData, model, targets)
            let droll = new Roll(weaponData.damage + bonusdamage);
            await droll.evaluate({async: true});
            subresult.damage = droll
        }
        return result
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
                if (getBaseToBaseDist(model, target) <= weapon.range/2){
                    return rapidfire.system.value
                }
            }
        return 0
    }
    _handleMelta(weapon, model, targeted) {
        let melta = weapon.items.find(x => x.name.toUpperCase() == "MELTA")
        if (!melta || !melta.system.value)
            return
        for (const target of targeted) {
            if (getBaseToBaseDist(model, target) <= weapon.range/2){
                return melta.system.value
            }
        }
        return 0
    }
}
