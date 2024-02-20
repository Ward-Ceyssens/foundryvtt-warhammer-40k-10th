/**
 * Extend the base Actor document to support attributes and groups with a custom template creation dialog.
 * @extends {Actor}
 */
export class WarhammerActor extends Actor {
    /** @inheritdoc */
    prepareDerivedData() {
        super.prepareDerivedData();
    }
    /**
     * Override getRollData() that's supplied to rolls.
     */
    getRollData() {
        this.prepareDerivedData()
        this.applyActiveEffects()
        const data = super.getRollData();
        // Prepare character roll data

        return data;
    }
    equals(item){
        if (this.type != item?.type)
            return false;

        if (this.name != item.name)
            return false;
        return  JSON.stringify(this.system) === JSON.stringify(item.system)
    }
}
