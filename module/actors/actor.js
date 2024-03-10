import {FACTIONS, getBaseToBaseDist} from "../constants.js";

/**
 * Extend the base Actor document to support attributes and groups with a custom template creation dialog.
 * @extends {Actor}
 */
//TODO split these in 2 using https://foundryvtt.wiki/en/development/guides/polymorphism-actors-items
export class WarhammerActor extends Actor {
    /** @inheritdoc */
    prepareDerivedData() {
        if (this.type === "objective" && canvas.initialized && this.token) {

        }
        super.prepareDerivedData();
    }
    equals(item){
        if (this.type != item?.type)
            return false;

        if (this.name != item.name)
            return false;
        let thisSystem = expandObject(flattenObject(this.system))
        let itemSystem = expandObject(flattenObject(item.system))
        delete thisSystem.stats.wounds.value
        delete itemSystem.stats.wounds.value
        return  JSON.stringify(thisSystem) === JSON.stringify(itemSystem)
    }

    generateCapturePercentages(){
        //group and total OC by faction
        let capture = this.system.tokens.map(id => canvas.tokens.get(id)).reduce((map, token) => {
                let faction = token.actor.system.faction
                if (map.has(faction))
                    map.set(faction, map.get(faction) + token.actor.system.stats.control)
                else
                    map.set(faction, token.actor.system.stats.control)
                return map
            }, new Map())

        //normalize
        capture = Array.from(capture)
        let total = capture.reduce((acc, val) => acc+val[1], 0)
        capture.map(val => val[1] /= total)
        return capture.sort((a,b) => a[0] > b[0] ? -1 : 1)
    }
    async updateObjective(token) {
        if (this.type !== "objective")
            return
        let models = canvas.tokens.placeables.filter(x =>
            x.actor.type === "model"
            && (getBaseToBaseDist(token, x) <= this.system.captureRange)
        )
        this.system.tokens = models.map(x => x.id)
        //group and total OC by faction
        let capture = this.generateCapturePercentages()

        //find highest, and count if multiple
        let max = this.system.captured ? ["Contested", 0] : ["Uncaptured", 0]
        let maxcount = 0
        for (const entry of capture) {
            if (entry[1] > max[1]) {
                max = entry
                maxcount = 1
                continue
            }
            if (entry[1] === max[1]) {
                maxcount += 1
            }
        }

        if (maxcount > 1)
            max = ["Contested", 0]

        //TODO check if doing this in every client causes issues
        await canvas.scene.updateEmbeddedDocuments("Token", [{
            _id: this.token._id,
            name: max[0],
        }])
        await this.update({
            _id: this._id,
            system:{
                captured: max[0] !== "Uncaptured",
            }
        })
        token.refresh()
    }
}
