
export const SYSTEM_ID = "warhammer-40k-10th"
export function mmToInch(mm) {
    return mm*0.039370
}

export function getBaseToBaseDist(token, target){
    return Math.max(0.001, canvas.grid.measureDistance(token.center, target.center) - mmToInch(token.actor.system.baseSize/2+target.actor.system.baseSize/2))
}

export const FACTIONS = {
    "ADEPTA SORORITAS": "#561113",
    "ADEPTUS ASTARTES": "#0c3455",
    "ADEPTUS CUSTODES": "#6A0E19",
    "ADEPTUS MECHANICUS": "#5d1615",
    "ADEPTUS TITANICUS": "#092135",
    "AELDARI": "#0a353a",
    "AGENTS OF THE IMPERIUM": "#1a3445",
    "ASTRA MILITARUM": "#082f1f",
    "CHAOS DAEMONS": "#313539",
    "CHAOS KNIGHTS": "#16352f",
    "DEATH GUARD": "#2c290c",
    "DRUKHARI": "#153737",
    "GENESTEALER CULTS": "#49203a",
    "GREY KNIGHTS": "#325b68",
    "HERETIC ASTARTES": "#5f1317",
    "IMPERIAL KNIGHTS": "#122d42",
    "LEAGUES OF VOTANN": "#572d0a",
    "NECRONS": "#006400",
    "ORKS": "#283109",
    "THOUSAND SONS": "#0b3645",
    "TYRANIDS": "#623462",
    "T’AU EMPIRE": "#175966",
    "WORLD EATERS": "#4d161a",
}