import {getBaseToBaseDist, SYSTEM_ID} from "../constants.js";
import {WarhammerActor} from "../actors/actor.js";

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

    getTagstring(){
        let tagstring = ""
        if (this.type !== "weapon")
            return tagstring
        let tags = []
        for (let tagid of this.system.tags) {
            let tag = this.actor.items.get(tagid)
            tags.push(tag)
        }

        if (tags.length !== 0)
            tagstring = '[' + tags.map(x => {
                let str = x.name
                if (x.system.value)
                    str += " "+x.system.value
                return str
            } ).join(", ") + ']';
        return tagstring
    }
    async fullAttack(controlled, targeted, weaponData, actorData, modifiers) {
        let targetData = foundry.utils.expandObject(foundry.utils.flattenObject(targeted.first().actor.system))

        weaponData.items = weaponData.items.filter(x => !x.system.optional || modifiers.tags.includes(x._id))
        if (weaponData.items.find(x => x.name.toUpperCase() == "IGNORES COVER"))
            actorData.modifiers.grants.cover=false

        if (weaponData.items.find(x => x.name.toUpperCase() == "LANCE"))
            actorData.modifiers.woundroll.bonus+=1

        //apply .grants to target
        this.actor._applymodifiers(actorData.modifiers.grants, targetData.modifiers)


        //apply .grants to actor
        this.actor._applymodifiers(targetData.modifiers.grants, actorData.modifiers)

        //apply weapon overrides
        // this._applymodifiers(actorData.modifiers.weapon, weaponData)

        //apply changes from dialog
        if (weaponData.range === 0)
            actorData.modifiers.hitroll.melee.bonus = modifiers.hitroll
        else
            actorData.modifiers.hitroll.ranged.bonus = modifiers.hitroll

        actorData.modifiers.woundroll.bonus = modifiers.woundroll

        if (modifiers.overwatch)
            actorData.modifiers.overwatch = modifiers.overwatchValue

        actorData.modifiers.grants.cover |= modifiers.cover

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
                damage: {
                    total: 0,
                    actual: 0,
                    lost: 0,
                },
                modelsDestroyed: 0,
                finalModelHP: {
                    value: 0,
                    max: targetData.stats.wounds.max,
                    show: false,
                },

            },
            hazardous: {
                destroyed: 0,
                wounded: 0,
            },
            //for dice so nice
            allRolls: []
        }

        let leastHPTarget = targeted.reduce((previousTarget, currentTarget) =>
                previousTarget.actor.system.stats.wounds.value < currentTarget.actor.system.stats.wounds.value ? previousTarget : currentTarget,
            targeted.first())
        let targetHp = leastHPTarget.actor.system.stats.wounds.value

        //par unit attack
        for (const model of controlled) {
            let bonusattacks = ""
            if (weaponData.items.find(x => x.name.toUpperCase() == "RAPID FIRE"))
                bonusattacks += "+" + this._handleRapidFire(weaponData, model, targeted)
            if (weaponData.items.find(x => x.name.toUpperCase() == "BLAST"))
                bonusattacks += "+" + Math.floor(targeted.size/5)

            let roll = new Roll(weaponData.attacks + bonusattacks);
            await roll.evaluate();
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
                    damage: {
                        total: 0,
                        actual: 0,
                        lost: 0,
                    },
                },
                targets: {
                    hit: actorData.modifiers.overwatch || weaponData.skill,
                    wound: this._woundMinRoll(weaponData.strength, targetData.stats.toughness),
                    save: (await this._calcSaveTarget(weaponData, targetData)).savetarget,
                    damage: targetData.feelnopain,
                },
                hazardousHtml: null,
            }
            //do attack
            for (let j = 0; j < roll.total; j++) {
                let results = await this._singleAttackRoll(model, foundry.utils.expandObject(foundry.utils.flattenObject(weaponData)), foundry.utils.expandObject(foundry.utils.flattenObject(actorData)), foundry.utils.expandObject(foundry.utils.flattenObject(targetData)), targeted);

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
                singleUnitAttackData.stats.wounds+= results.rest.reduce((previousValue, currentValue) => previousValue + currentValue.wounded || 0, 0)
                singleUnitAttackData.stats.saves+= results.rest.reduce((previousValue, currentValue) => previousValue + currentValue.notsaved || 0, 0)
                for (const rest of results.rest) {
                    let damage = rest.damage?.total || 0
                    singleUnitAttackData.stats.damage = {
                        total: singleUnitAttackData.stats.damage.total + damage,
                        actual: singleUnitAttackData.stats.damage.actual + Math.min(damage, targetHp),
                        lost: singleUnitAttackData.stats.damage.lost + (damage - Math.min(damage, targetHp)),
                    }
                    targetHp-=damage
                    if (targetHp <= 0){
                        targetHp = leastHPTarget.actor.system.stats.wounds.max
                        completeAttackData.stats.modelsDestroyed++
                    }
                }

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
            for (const damageKey in singleUnitAttackData.stats.damage) {
                completeAttackData.stats.damage[damageKey] += singleUnitAttackData.stats.damage[damageKey]
            }

            if (weaponData.items.find(x => x.name.toUpperCase() == "HAZARDOUS")){
                singleUnitAttackData.hazardousHtml = "Hazardous check:"
                let roll = new Roll('1d6');
                await roll.evaluate();
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
        completeAttackData.stats.finalModelHP.value = targetHp
        completeAttackData.stats.finalModelHP.show = targetHp !== completeAttackData.stats.finalModelHP.max
        this._battleToMessage(completeAttackData)
    }

    async _singleAttackRoll(model, weaponData, actorData, targetData, targets) {
        let isMelee = weaponData.range === 0
        let indirect_fire = weaponData.items.find(x => x.name.toUpperCase() === "INDIRECT FIRE")
        if (indirect_fire
            //check if we can target anyone normally (visible to given token)
            && (indirect_fire.system.optional || //if set as optional then this tag is turned on intentionally for this attack, meaning we apply the effects regardless of LOS
                //if not set as optional then check LOS to see if this should apply
                !targets.some((target) => model.los.contains(target.center.x, target.center.y) && getBaseToBaseDist(model, target) <= weaponData.range))){
            actorData.modifiers.hitroll.ranged.bonus-=1
            actorData.modifiers.hitroll.melee.bonus-=1
            targetData.modifiers.cover=true
        }
        let result = {
            hitroll: "",
            hits: 0,
            rest: []
        }

        //hit
        let critHit = false
        if (weaponData.items.find(x => x.name.toUpperCase() === "TORRENT")){
            result.hitroll = {
                total: "N/A",
                isDeterministic: true,
            }
        } else {
            let hitstr = `1d6`
            let hitTargetNum = weaponData.skill;
            if (weaponData.items.find(x => x.name.toUpperCase() === "HEAVY")){
                actorData.modifiers.hitroll.ranged.bonus += 1
                actorData.modifiers.hitroll.melee.bonus += 1
            }
            if ((actorData.modifiers.hitroll.ranged.bonus && !isMelee)
                || (actorData.modifiers.hitroll.melee.bonus && isMelee) )
                hitstr += "+" + Math.max(-1, Math.min(1, actorData.modifiers.hitroll[isMelee ? "melee" : "ranged"].bonus))

            if (actorData.modifiers.overwatch){
                hitstr = '1d6'
                hitTargetNum = actorData.modifiers.overwatch
            }

            let hroll = new Roll(hitstr);
            await hroll.evaluate();
            let hit = hroll.total >= hitTargetNum
            if (hroll.dice.find(x => x.values.includes(1)))
                hit = false
            if (this._shouldCrit(actorData.modifiers.hitroll[isMelee ? "melee" : "ranged"].crit, hroll, hit)){
                hit = true
                critHit = true
            }


            //rerolls
            if (this._shouldReroll(actorData.modifiers.hitroll[isMelee ? "melee" : "ranged"].reroll, hroll, hit)){

                //reroll updates dice but not rest of roll like the total
                await hroll.dice[0].reroll("r<7")
                hroll = Roll.fromTerms(hroll.terms)
                result.hitroll= hroll
                hit = hroll.total >= hitTargetNum
                critHit = false;
                if (hroll.dice.find(x => x.values.includes(1)))
                    hit = false
                if (this._shouldCrit(actorData.modifiers.hitroll[isMelee ? "melee" : "ranged"].crit, hroll, hit)){
                    hit = true
                    critHit = true
                }
            }
            result.hitroll = hroll

            if (!hit) {
            result.rest.push({})
            return result
            }
        }
        let numhits = 1
        if (critHit && weaponData.items.find(x => x.name.toUpperCase() === "SUSTAINED HITS")){
            numhits += (await (new Roll(weaponData.items.find(x => x.name.toUpperCase() === "SUSTAINED HITS").system.value)).evaluate()).total
        }
        result.hits = numhits
        for (let i = 0; i < numhits; i++) {
            //extra hits arent crits
            if (i > 0){
                critHit = false
            }
            let subresult = {
                // wound: "",
                wounded: false,
                // save: "",
                notsaved: false,
                // damage: "",
            }
            result.rest.push(subresult)

            //wound
            let critWound = false
            if (critHit && weaponData.items.find(x => x.name.toUpperCase() === "LETHAL HITS")) {
                subresult.wound = {
                    total: "N/A",
                    isDeterministic: true,
                }
                subresult.wounded = true
            } else {
                for (let anti of weaponData.items.filter(x => x.name.toUpperCase().startsWith("ANTI-"))) {
                    let targettag = anti.name.split("-")[1]
                    if (targetData.tags.map(x => x.toUpperCase()).includes(targettag.toUpperCase())){
                        actorData.modifiers.woundroll.crit.push(anti.system.value.toString())
                    }
                }
                let woundstr = `1d6`
                if (actorData.modifiers.woundroll.bonus)
                    woundstr += "+" + Math.max(-1, Math.min(1, (await (new Roll("0+" + actorData.modifiers.woundroll.bonus)).evaluate()).total))
                let successnum = this._woundMinRoll(weaponData.strength, targetData.stats.toughness)

                let wroll = new Roll(woundstr);
                await wroll.evaluate();
                subresult.wounded = wroll.total >= successnum

                if (wroll.dice.find(x => x.values.includes(1)))
                    subresult.wounded = false
                if (this._shouldCrit(actorData.modifiers.woundroll.crit, wroll, subresult.wounded)) {
                    subresult.wounded = true
                    critWound = true
                }

                if (!subresult.wounded && weaponData.items.find(x => x.name.toUpperCase() === "TWIN-LINKED")) {
                    actorData.modifiers.woundroll.reroll.push("fail")
                }
                //rerolls
                if (this._shouldReroll(actorData.modifiers.woundroll.reroll, wroll, subresult.wounded)){
                    await wroll.dice[0].reroll("r<7")
                    wroll = Roll.fromTerms(wroll.terms)
                    subresult.wounded = wroll.total >= successnum
                    critWound = false;
                    if (wroll.dice.find(x => x.values.includes(1)))
                        subresult.wounded = false
                    if (this._shouldCrit(actorData.modifiers.woundroll.crit, wroll, subresult.wounded)) {
                        subresult.wounded = true
                        critWound = true
                    }
                }
                subresult.wound = wroll

                if (!subresult.wounded) {
                    continue
                }
            }

            //save
            if (critWound && weaponData.items.find(x => x.name.toUpperCase() === "DEVASTATING WOUNDS")) {
                subresult.save = {
                    total: "N/A",
                    isDeterministic: true,
                }
                subresult.notsaved = true
            } else {
                let {savemod, savetarget} = await this._calcSaveTarget(weaponData, targetData);

                let sroll = new Roll(`1d6` + savemod);
                await sroll.evaluate();
                subresult.save = sroll
                subresult.notsaved = sroll.total < savetarget
                if (sroll.dice.find(x => x.values.includes(1)))
                    subresult.notsaved = true
                if (!subresult.notsaved) {
                    continue
                }
            }

            //damage
            let bonusdamage = ""
            if (weaponData.items.find(x => x.name.toUpperCase() === "MELTA"))
                bonusdamage += "+" + this._handleMelta(weaponData, model, targets)
            let damageformula = weaponData.damage + bonusdamage
            if (targetData.feelnopain){
                damageformula = `(${damageformula})d6cs<${targetData.feelnopain}`
            }
            let droll = new Roll(damageformula);
            await droll.evaluate();
            subresult.damage = droll
        }
        return result
    }

    async _calcSaveTarget(weaponData, targetData) {
        let savemod = "+" + weaponData.ap

        //cover
        if (targetData.modifiers.cover &&
            !(targetData.stats.save >= 3 && weaponData.ap === 0))
            savemod += "+1[cover]"
        let modifiedSavestat = targetData.stats.save - (await (new Roll(savemod)).evaluate()).total

        let savetarget = targetData.stats.save
        if (targetData.invulnsave && modifiedSavestat > targetData.invulnsave){
            savetarget = targetData.invulnsave
            savemod = "-0[invuln]"
        }
        return {savemod, savetarget};
    }

    _inRange(controlled, targeted, range) {
        for (const target of targeted) {
            range = target.actor?.system?.loneOperative ?  12 : range
        }
        if (range === 0){
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
        let baseToBase = controlled.filter( token => {
            for (const target of firstPass) {
                if (getBaseToBaseDist(token, target) <= game.settings.get(SYSTEM_ID, "melee_generosity"))
                    return true
            }
            return false
        })

        let engagement = controlled.filter( token => {
            for (const target of targeted) {
                if (getBaseToBaseDist(token, target) <= 1)
                    return true
            }
            return false
        })
        return [...new Set([...engagement,...baseToBase])];
    }

    _woundMinRoll(strength, toughness){
        if (strength >= toughness*2)
            return 2
        if (strength > toughness)
            return 3
        if (strength === toughness)
            return 4
        if (strength*2 <= toughness)
            return 6
        return 5
    }

    async _battleToMessage(data, messageData={}, {rollMode, create=true}={}) {

        data.models = WarhammerActor.reduceToCount(data.models)
        data.targets = WarhammerActor.reduceToCount(data.targets)

        let html = Handlebars.partials[`systems/${SYSTEM_ID}/templates/chatmessage.hbs`](data)

        // Prepare chat data
        messageData = foundry.utils.mergeObject({
            speaker: ChatMessage.getSpeaker(),
            content: html,
            user: game.user.id,
            // style: CONST.CHAT_MESSAGE_STYLES.ROLL,
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
        let rapidfire = weapon.items.find(x => x.name.toUpperCase() === "RAPID FIRE")
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
        let melta = weapon.items.find(x => x.name.toUpperCase() === "MELTA")
        if (!melta || !melta.system.value)
            return
        for (const target of targeted) {
            if (getBaseToBaseDist(model, target) <= weapon.range/2){
                return melta.system.value
            }
        }
        return 0
    }

    _shouldReroll(rerolls, roll, success){
        for (const reroll of rerolls) {
            //yes this chain is stupid, it's to support more text cases in the future
            if (isNaN(parseInt(reroll))){
                switch (reroll) {
                    case 'fail':
                        if (!success)
                            return true
                        break
                    default:
                        return false
                }
            } else {
                if (roll.dice[0].total <= parseInt(reroll))
                    return true
            }
        }
        return false
    }
    _shouldCrit(crits, roll, success){
        for (const crit of crits) {
            //yes this chain is stupid, it's to support more text cases in the future
            if (isNaN(parseInt(crit))){
                switch (crit) {
                    case 'success':
                        if (success)
                            return true
                        break
                    default:
                        return false
                }
            } else {
                if (roll.dice[0].total >= parseInt(crit))
                    return true
            }
        }
        return false
    }

}