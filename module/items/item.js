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
}