
export const SYSTEM_ID = "warhammer-40k-10th"
export function mmToInch(mm) {
    return mm*0.039370
}

export function getBaseToBaseDist(token, target){
    return Math.max(0.001, canvas.grid.measureDistance(token.center, target.center) - mmToInch(token.actor.system.baseSize/2+target.actor.system.baseSize/2))
}