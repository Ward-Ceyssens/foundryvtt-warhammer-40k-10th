import {FACTIONS} from "./constants.js";

const OPTIONAL_TAGS = ['HEAVY', 'LANCE', 'INDIRECT FIRE']
export class RosterImporter {
    static async import(xml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, "application/xml");
        // print the name of the root element or error message
        const errorNode = doc.querySelector("parsererror");
        if (errorNode) {
            ui.notifications.error("Could not read file: error while parsing")
        }
        // console.log(doc)
        let folder = await Folder.create({name: doc.getElementsByTagName("roster")[0].getAttribute('name'), type: "Actor"})
        let units = [...doc.querySelectorAll("force > selections > selection")]
        units = units.filter(s => ['model', "unit"].includes(s.getAttribute('type')))
        units.map(async selection => {
            try {
                await this._importUnit(selection, folder)
            } catch (e) {
                ui.notifications.error("error while importing \"" + (selection.querySelector("selection[type='model']") || selection).getAttribute('name') + "\" some items may be missing: see console for details")
                console.error(e)
            }
        })
    }

    static async _importUnit(xml, folder){
        let units = xml.querySelectorAll("selection[type='model']")
        if (units.length === 0)
            units = [xml]
        for (const unitXml of units) {

            let data = {
                name: unitXml.getAttribute('name') || xml.getAttribute('name'),
                folder: folder.id,
                type: "model",
                system: {
                    stats: {}
                },
            }

            // (faction) tags
            let tags = [...xml.querySelectorAll("categories category")]
            tags = tags.map(tag => tag.getAttribute('name'))
            let factionTag = tags.filter(value => value.startsWith("Faction:")).map(s=>s.slice("Faction: ".length).toUpperCase())
            factionTag = factionTag.filter(s => FACTIONS[s])
            data.system.faction = factionTag
            data.system.tags = Array.from(new Set(tags.filter(value => !value.startsWith("Faction:"))))

            let statXml = unitXml.querySelector("characteristic[name='M']") ? unitXml : xml
            //stats
            data.system.stats.move = statXml.querySelector("characteristic[name='M']").firstChild.nodeValue.replace("\"", '').replace("+", '')
            data.system.stats.toughness = statXml.querySelector("characteristic[name='T']").firstChild.nodeValue
            data.system.stats.save = statXml.querySelector("characteristic[name='SV']").firstChild.nodeValue.replace("+", '')
            data.system.stats.wounds = {
                value: statXml.querySelector("characteristic[name='W']").firstChild.nodeValue,
                max: statXml.querySelector("characteristic[name='W']").firstChild.nodeValue
            }
            data.system.stats.leadership = statXml.querySelector("characteristic[name='LD']").firstChild.nodeValue.replace("+", '')
            data.system.stats.control = statXml.querySelector("characteristic[name='OC']").firstChild.nodeValue

            //items
            let actor = await Actor.create(data)
            let rules = Array.from(xml.children).find(a => a.tagName === "rules")

            if (rules) {
                for (const rule of rules.children) {
                    await this._importItem(rule, actor)
                }
            }
            let abilities = Array.from(xml.querySelectorAll("profile[typeName='Abilities']"))
            abilities.forEach(a => this._importItem(a, actor))

            let weapons = Array.from(unitXml.children).find(a => a.tagName === "selections")
            let recursiveSelections = a => {
                if (a.firstElementChild.tagName === "selections") {
                    for (const child of a.firstChild.children) {
                        recursiveSelections(child)
                    }
                    return
                }
                this._importItem(a, actor)
            }
            for (const weapon of weapons.children) {
                recursiveSelections(weapon)
            }
        }
    }

    static async _importItem(xml, actor){
        try {
            if (xml.tagName === "rule")
                await this._importRule(xml, actor)
            else if (xml.getAttribute('typeName') === "Abilities")
                await this._importAbility(xml, actor)
            else if (xml.tagName === "selection" && ["rules", "profiles"].includes(xml.firstElementChild.tagName))
                await this._importWeapon(xml, actor)
        }
        catch (e) {
            ui.notifications.error("error while importing \"" + actor.name + "\" some items may be missing: see console for details")
            console.error(e)
        }

    }

    static async _importRule(xml, actor){
        let data = {
            type: "ability",
            system : {}
        }
        data.name = xml.getAttribute('name')
        try {
            data.system.description = xml.querySelector("description").firstChild.textContent

            if (data.name === "Stealth") {
                await ActiveEffect.create({
                    name: data.name,
                    changes: [{
                        key: 'system.modifiers.grants.hitroll.ranged.bonus',
                        value: -1,
                        mode: 5,
                    }]
                }, {parent: actor})
            }
            if (data.name === "Lone Operative") {
                await ActiveEffect.create({
                    name: data.name,
                    changes: [{
                        key: 'system.loneOperative',
                        value: true,
                        mode: 5,
                    }]
                }, {parent: actor})
            }

            await Item.create(data, {parent: actor})
        } catch (e) {
            ui.notifications.error("error while importing ability '" + data.name + "' on actor '"+ actor.name + "', item omitted")
            console.error(e)
        }
    }

    static async _importAbility(xml, actor){
        let data = {
            type: "ability",
            system : {}
        }
        data.name = xml.getAttribute('name')
        try {
            data.system.description = xml.querySelector("characteristic[name='Description']").firstChild.textContent
            if (data.name === "Invulnerable Save") {
                await ActiveEffect.create({
                    label: data.name,
                    changes: [{
                        key: 'system.invulnsave',
                        //NOTE make this less fragile at some point
                        value: data.system.description.match(/(\d)+/)[1],
                        mode: 5,
                    }]
                }, {parent: actor})
                return
            }
            await Item.create(data, {parent: actor})
        } catch (e) {
            ui.notifications.error("error while importing ability '" + data.name + "' on actor '"+ actor.name + "', item omitted")
            console.error(e)
        }
    }

    static async _importWeapon(xml, actor){
        for (const profile of xml.querySelectorAll("profile")) {
            if (!profile.getAttribute("typeName").endsWith("Weapons")) {
                continue
            }
            let data = {
                type: "weapon",
                system: {}
            }
            data.name = profile.getAttribute('name')
            try {
                data.system.range = profile.querySelector("characteristic[name='Range']").firstChild.nodeValue.replace("\"", '').replace("Melee", '0')
                data.system.attacks = profile.querySelector("characteristic[name='A']").firstChild.nodeValue.replace(/(?:\D|^)D(\d)/, ' 1D$1')
                data.system.skill = profile.querySelector("characteristic[name='BS'], characteristic[name='WS']").firstChild.nodeValue.replace("N/A", '0').replace("+", '')
                data.system.strength = profile.querySelector("characteristic[name='S']").firstChild.nodeValue
                data.system.ap = profile.querySelector("characteristic[name='AP']").firstChild.nodeValue
                data.system.damage = profile.querySelector("characteristic[name='D']").firstChild.nodeValue.replace(/(?:\D|^)D(\d)/, ' 1D$1')

                let tags = profile.querySelector("characteristic[name='Keywords']")?.firstChild?.nodeValue.replace(/(?:\D|^)D(\d)/, ' 1D$1').replace("+", '').split(",")
                //clean up tag list
                tags = tags.map(i => i.trim()).filter(i => i)
                if (!tags || tags[0] === "-")
                    tags = []
                data.system.tags = []
                for (const tag of tags) {
                    data.system.tags.push(await this._importWTag(tag, xml.querySelector("rules"), actor))
                }
                let item = await Item.create(data, {parent: actor})
            } catch (e) {
                ui.notifications.error("error while importing weapon '" + data.name + "' on actor '"+ actor.name + "', item omitted")
                console.error(e)
            }
        }
    }

    static async _importWTag(tag, rules, actor){
        try {
            let data = {
                type: "wtag",
                system: {}
            }
            let valueRegx = new RegExp(/(\D+)(\d+.*)?/)
            let match = tag.match(valueRegx)

            data.name = match[1].trim()
            data.system.value = match[2]?.trim()

            for (const rule of rules.children) {
                const name = rule.getAttribute('name').toUpperCase();
                if (name === data.name.toUpperCase()
                    || name === tag.toUpperCase()
                    || (name.startsWith("ANTI-") && name === data.name.slice(0, "ANTI-".length).toUpperCase())) {
                    data.system.description = rule.firstChild.textContent
                }
            }
            if (!data.system.description) {
                // console.log(tag, rules, actor)
                console.warn("Could not find description for weapon tag '" + data.name + "' on actor '" + actor.name + "', proceeding with blank description")
            }

            if (OPTIONAL_TAGS.includes(data.name.toUpperCase()))
                data.system.optional = true

            let item = await Item.create(data, {parent: actor})
            return item.id
        } catch (e) {
            ui.notifications.error("error while importing weapon tag '" + data.name + "' on actor '"+ actor.name + "', tag omitted")
            console.error(e)
        }
    }
}