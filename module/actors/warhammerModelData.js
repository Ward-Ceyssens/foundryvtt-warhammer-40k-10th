import {WeaponData} from "../items/weaponData.js";

class SplitStringField extends foundry.data.fields.StringField {
    initialize(value, model) {
        return (value||"").split(",").map(x => x.trim());
    }

}

class WeaponModifiers extends WeaponData {
    static defineSchema() {
        const fields = foundry.data.fields;
        let schema = super.defineSchema()
        for (const schemaKey in schema) {
            schema[schemaKey].required = false
            schema[schemaKey].nullable = true
            schema[schemaKey].initial = undefined
        }
        delete schema.tags
        delete schema.description
        return schema
    }

}

class WarhammerModifiersField extends foundry.data.fields.SchemaField {

    constructor(object) {
        if (!object)
            object = {}
        const fields = foundry.data.fields;
        super(foundry.utils.mergeObject({
            hitroll: new fields.SchemaField({
                melee: new fields.SchemaField({
                        bonus: new fields.NumberField({
                            required: false,
                            nullable: true,
                            integer: true,
                        }),
                        reroll: new fields.ArrayField(new fields.StringField({required: false}), {required:false, nullable:false, initial:[]}),
                        crit: new fields.ArrayField(new fields.StringField({required: false}), {required:false, initial:["6"]}),

                    }),
                ranged: new fields.SchemaField({
                    bonus: new fields.NumberField({
                        required: false,
                        nullable: true,
                        integer: true,
                    }),
                    reroll: new fields.ArrayField(new fields.StringField({required: false}), {required:false, nullable:false, initial:[]}),
                    crit: new fields.ArrayField(new fields.StringField({required: false}), {required:false, initial:["6"]}),
                }),
            }),
            woundroll: new fields.SchemaField({
                bonus: new fields.NumberField({
                    required: false,
                    nullable: true,
                    integer: true,
                }),
                reroll: new fields.ArrayField(new fields.StringField({required: false}), {required:false, nullable:false, initial:[]}),
                crit: new fields.ArrayField(new fields.StringField({required: false}), {required:false, initial:["6"]}),
            }),
            cover: new fields.BooleanField({
                required: false,
                nullable: true,
                // initial: null
            }),
            //could be useful at some point
            // weapon: new fields.SchemaField(WeaponModifiers.defineSchema(),{
            //         required: false,
            //         nullable: true,
            //         // initial: null
            //     })
        },
            object));
    }
}
export class WarhammerModelData extends foundry.abstract.DataModel {
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
                        initial: 1,
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
                        initial: 1,
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
            faction: new fields.StringField({
                initial: "NECRONS"
            }),
            invulnsave: new fields.NumberField({
                nullable: true,
                required: true,
                initial: null,
                integer: true
            }),
            feelnopain: new fields.NumberField({
                nullable: true,
                required: true,
                integer: true
            }),
            loneOperative: new fields.BooleanField({
                required: true,
                initial: false
            }),
            modifiers: new WarhammerModifiersField({
                grants: new WarhammerModifiersField(),
            }),
        };
    }
}