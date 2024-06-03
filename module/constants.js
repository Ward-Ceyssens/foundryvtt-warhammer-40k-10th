
export const SYSTEM_ID = "warhammer-40k-10th"
export function mmToInch(mm) {
    return mm*0.039370
}

export function getBaseToBaseDist(token, target){
    return Math.max(0.001, canvas.grid.measurePath([token.center, target.center]).distance - mmToInch(token.actor.system.baseSize/2+target.actor.system.baseSize/2))
}

export const FACTIONS = {
    "ADEPTA SORORITAS": {
        color : "#561113",
    },
    "ADEPTUS ASTARTES": {
        color : "#0c3455",
    },
    "ADEPTUS CUSTODES": {
        color : "#6A0E19",
    },
    "ADEPTUS MECHANICUS": {
        color : "#5d1615",
    },
    "ADEPTUS TITANICUS": {
        color : "#092135",
    },
    "AELDARI": {
        color : "#0a353a",
    },
    "AGENTS OF THE IMPERIUM": {
        color : "#1a3445",
    },
    "ASTRA MILITARUM": {
        color : "#082f1f",
    },
    "CHAOS DAEMONS": {
        color : "#313539",
    },
    "CHAOS KNIGHTS": {
        color : "#16352f",
    },
    "DEATH GUARD": {
        color : "#2c290c",
    },
    "DRUKHARI": {
        color : "#153737",
    },
    "GENESTEALER CULTS": {
        color : "#49203a",
    },
    "GREY KNIGHTS": {
        color : "#325b68",
    },
    "HERETIC ASTARTES": {
        color : "#5f1317",
    },
    "IMPERIAL KNIGHTS": {
        color : "#122d42",
    },
    "LEAGUES OF VOTANN": {
        color : "#572d0a",
    },
    "NECRONS": {
        color : "#006400",
    },
    "ORKS": {
        color : "#283109",
    },
    "THOUSAND SONS": {
        color : "#0b3645",
    },
    "TYRANIDS": {
        color : "#623462",
    },
    "T'AU EMPIRE": {
        color : "#175966",
    },
    "WORLD EATERS": {
        color : "#4d161a",
    },
}