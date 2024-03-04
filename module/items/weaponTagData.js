export class WeaponTagData extends foundry.abstract.DataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            description: new fields.HTMLField(),
            value: new fields.StringField({
                required: false,
                validate: (s) => {
                    return Roll.validate(s)
                }
            }),
            optional: new fields.BooleanField({
                required: true,
                initial: false
            }),
            // weapon: new fields.StringField({
            //     required: true,
            //     blank: false,
            // })
        }
    }
}