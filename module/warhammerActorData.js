class SplitStringField extends foundry.data.fields.StringField {
    initialize(value, model) {
        return value.split(",");
    }

}
export class WarhammerActorData extends foundry.abstract.DataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            biography: new fields.HTMLField(),
            stats: new fields.SchemaField({
                //in inches
                move: new fields.NumberField({
                    nullable: false,
                    required: true,
                    initial: 0,
                    integer: true
                }),
                toughness: new fields.NumberField({
                    nullable: false,
                    required: true,
                    initial: 0,
                    integer: true
                }),
                save: new fields.NumberField({
                    nullable: false,
                    required: true,
                    initial: 0,
                    integer: true
                }),
                wounds: new fields.SchemaField({
                    value: new fields.NumberField({
                        nullable: false,
                        required: true,
                        initial: 10,
                        integer: true
                    }),
                    min: new fields.NumberField({
                        nullable: false,
                        required: true,
                        initial: 0,
                        integer: true
                    }),
                    max: new fields.NumberField({
                        nullable: false,
                        required: true,
                        initial: 10,
                        integer: true,
                    })
                }),
                leadership: new fields.NumberField({
                    nullable: false,
                    required: true,
                    initial: 0,
                    integer: true
                }),
                control: new fields.NumberField({
                    nullable: false,
                    required: true,
                    initial: 0,
                    integer: true
                }),
            }),
            //in mm
            baseSize: new fields.NumberField({
                nullable: false,
                required: true,
                initial: 32,
                integer: true
            }),
            tags: new SplitStringField(),
            faction: new fields.StringField(),
            modifiers: new fields.SchemaField({
                hitroll: new fields.NumberField({
                    required: true,
                    nullable: true,
                    integer: true,
                }),
                woundroll: new fields.NumberField({
                    required: true,
                    nullable: true,
                    integer: true,
                }),
                cover: new fields.BooleanField({}),
                grants: new fields.SchemaField({
                    hitroll: new fields.NumberField({
                        required: true,
                        nullable: true,
                        integer: true,
                    }),
                    woundroll: new fields.NumberField({
                        required: true,
                        nullable: true,
                        integer: true,
                    }),
                    cover: new fields.BooleanField({})
                }),
            }),
        };
    }
}