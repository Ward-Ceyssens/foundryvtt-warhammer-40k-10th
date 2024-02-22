import {getBaseToBaseDist, SYSTEM_ID} from "../constants.js";

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class WarhammerItem extends Item {
    /**
     * Augment the basic Item data model with additional dynamic data.
     */
    prepareData() {
        super.prepareData();
    }
    delete(){
        if (this.type == "weapon"){
            for (const tagId of this.system.tags) {
                this.actor.items.get(tagId).delete()
            }
        }
        super.delete()
    }
    equals(item){
        if (this.type != item?.type)
            return false;

        if (this.name != item.name)
            return false;
        if (this.type == "weapon"){
            return this._weaponEquals(item)
        }
        if (this.type == "wtag"){
            return this._wtagEquals(item)
        }
        return JSON.stringify(this.system) === JSON.stringify(item.system)
    }

    _weaponEquals(item) {
        if (this.system.range != item.system.range
            || this.system.attacks != item.system.attacks
            || this.system.skill != item.system.skill
            || this.system.strength != item.system.strength
            || this.system.ap != item.system.ap
            || this.system.damage != item.system.damage
            || this.system.tags?.length != item.system.tags?.length
        )
            return false;
        for (let i = 0; i < this.system.tags.length; i++) {
            if (!this.actor.items.get(this.system.tags[i]).equals(item.actor.items.get( item.system.tags[i])))
                return false;
        }
        return true
    }
    _wtagEquals(item) {
        return this.system.value == item.system.value
    }


    async fullAttack(controlled, targeted, weaponData, actorData, modifiers) {
        let targetData = expandObject(flattenObject(targeted.first().actor.system))
        //apply changes from dialog
        if (weaponData.range === 0)
            actorData.modifiers.hitroll.melee += modifiers.hitroll
        else
            actorData.modifiers.hitroll.ranged += modifiers.hitroll

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
        //apply .grants to actordata
        for (const actorDataKey in actorData.modifiers.grants) {
            actorData.modifiers[actorDataKey] = targetData.modifiers.grants[actorDataKey]
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
            //for dice so nice
            allRolls: []
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
            if (!roll.isDeterministic)
                completeAttackData.allRolls.push(roll)
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
                targets: {
                    hit: weaponData.skill,
                    wound: this._woundMinRoll(weaponData.strength, targetData.stats.toughness),
                    save: (await this._calcSaveTarget(weaponData, targetData)).savetarget,
                    damage: targetData.feelnopain,
                },
                hazardousHtml: null,
            }
            //do attack
            for (let j = 0; j < roll.total; j++) {
                let results = await this._singleAttackRoll(model, expandObject(flattenObject(weaponData)), expandObject(flattenObject(actorData)), expandObject(flattenObject(targetData)), targeted);
                // singleUnitAttackData.details.push(await Promise.all(results.map(async roll => {
                //     return roll.isDeterministic ? roll.total : await roll.render()
                // })));
                //update stats
                if (!results.hitroll.isDeterministic)
                    completeAttackData.allRolls.push(results.hitroll)
                results.rest.map(x => {
                    if (x.wound && !x.wound.isDeterministic)
                        completeAttackData.allRolls.push(x.wound)
                    if (x.save && !x.save.isDeterministic)
                        completeAttackData.allRolls.push(x.save)
                    if (x.damage && !x.damage.isDeterministic)
                        completeAttackData.allRolls.push(x.damage)
                })
                singleUnitAttackData.stats.hits += results.hits
                singleUnitAttackData.stats.wounds+= results.rest.reduce((previousValue, currentValue) => previousValue + Boolean(currentValue.wound), 0)
                singleUnitAttackData.stats.saves+= results.rest.reduce((previousValue, currentValue) => previousValue + Boolean(currentValue.save), 0)
                singleUnitAttackData.stats.damage+= results.rest.reduce((previousValue, currentValue) => previousValue + currentValue.damage?.total || 0, 0)

                //render html
                results.hitroll = results.hitroll.isDeterministic ? results.hitroll.total : await results.hitroll.render()
                for (const restItem of results.rest) {
                    restItem.wound = restItem.wound?.isDeterministic ? restItem.wound.total : await restItem.wound?.render()
                    restItem.save = restItem.save?.isDeterministic ? restItem.save.total : await restItem.save?.render()
                    restItem.damage = restItem.damage?.isDeterministic ? restItem.damage.total : await restItem.damage?.render()
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
        this._battleToMessage(completeAttackData)
    }

    async _singleAttackRoll(model, weaponData, actorData, targetData, targets) {
        let isMelee = weaponData.range === 0
        if (weaponData.items.find(x => x.name.toUpperCase() == "INDIRECT FIRE")
            //check if we can target anyone normally (visible to given token)
            && !targets.some((target) => model.los.contains(target.center.x, target.center.y) && getBaseToBaseDist(model, target) <= weaponData.range)){
            actorData.modifiers.hitroll.ranged-=1
            actorData.modifiers.hitroll.melee-=1
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
            result.hitroll = {
                total: "N/A",
                isDeterministic: true,
            }
        } else {
            let hitstr = `1d6`
            if (weaponData.items.find(x => x.name.toUpperCase() == "HEAVY")){
                actorData.modifiers.hitroll.ranged += 1
                actorData.modifiers.hitroll.melee += 1
            }
            if ((actorData.modifiers.hitroll.ranged && !isMelee)
                || (actorData.modifiers.hitroll.melee && isMelee) )
                hitstr += "+" + Math.max(-1, Math.min(1, actorData.modifiers.hitroll[isMelee ? "melee" : "ranged"]))


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
                    total: "N/A",
                    isDeterministic: true,
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
                    total: "N/A",
                    isDeterministic: true,
                }
            } else {
                let {savemod, savetarget} = await this._calcSaveTarget(weaponData, targetData);

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
            let damageformula = weaponData.damage + bonusdamage
            if (targetData.feelnopain){
                damageformula = `(${damageformula})d6cs<${targetData.feelnopain}`
            }
            let droll = new Roll(damageformula);
            await droll.evaluate({async: true});
            subresult.damage = droll
        }
        return result
    }

    async _calcSaveTarget(weaponData, targetData) {
        let savemod = "+" + weaponData.ap

        //cover
        if (targetData.modifiers.cover &&
            !(targetData.stats.save >= 3 && weaponData.ap === 0))
            savemod += "+1"
        let modifiedSavestat = targetData.stats.save - (await (new Roll(savemod)).evaluate({async: true})).total

        let savetarget = targetData.stats.save
        if (modifiedSavestat > targetData.invulnsave)
            savetarget = targetData.invulnsave
        return {savemod, savetarget};
    }

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

    async _battleToMessage(data, messageData={}, {rollMode, create=true}={}) {

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
            sound: CONFIG.sounds.dice,
            rolls: data.allRolls
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