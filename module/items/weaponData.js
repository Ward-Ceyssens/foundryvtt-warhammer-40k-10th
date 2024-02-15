export class WeaponData extends foundry.abstract.DataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            description: new fields.HTMLField(),
            range: new fields.NumberField({
                required: true,
                initial: 0,
                integer: true
            }),
            attacks: new fields.StringField({
                required: true,
                initial: "1",
                blank: false,
                validate:  (s) => {return Roll.validate(s)}
            }),
            skill: new fields.NumberField({
                required: true,
                initial: 0,
                integer: true,
                max: 6,
                min: 0,
            }),
            strength: new fields.NumberField({
                required: true,
                initial: 0,
                integer: true,
                min: 0,
            }),
            ap: new fields.NumberField({
                required: true,
                initial: 0,
                integer: true,
                max: 0
            }),
            damage: new fields.StringField({
                required: true,
                initial: "0",
                blank: false,
                validate: (s) => {return Roll.validate(s)}
            }),
            tags: new fields.ArrayField(new fields.StringField()),
        };
    }
}

