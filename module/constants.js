
export const SYSTEM_ID = "warhammer-40k-10th"
export function mmToInch(mm) {
    return mm*0.039370
}

export function getBaseToBaseDist(token, target){
    return Math.max(0.001, canvas.grid.measureDistance(token.center, target.center) - mmToInch(token.actor.system.baseSize/2+target.actor.system.baseSize/2))
}

export const FACTIONS = {
    "NECRONS": "#006400",
    "TYRANIDS": "#623462",
    "ADEPTA SORORITAS": "#561113",
    "ADEPTUS CUSTODES": "#6A0E19",
    "ADEPTUS MECHANICUS": "#5d1615",
}