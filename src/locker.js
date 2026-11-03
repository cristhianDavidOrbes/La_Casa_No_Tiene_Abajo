export const LOCKER_CANDIDATES=[1,2,3];

export function chooseLockerRooms(random=Math.random){
 const candidates=[...LOCKER_CANDIDATES];
 for(let i=candidates.length-1;i>0;i--){const j=Math.min(i,Math.floor(random()*(i+1)));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 return candidates.slice(0,2).sort();
}

export function validLockerRooms(value){return Array.isArray(value)&&value.length===2&&value[0]!==value[1]&&value.every(n=>Number.isInteger(n)&&LOCKER_CANDIDATES.includes(n));}

export class LockerSearch{
 constructor(random=Math.random){this.random=random;this.hiddenRoom=null;this.lastSeenRoom=null;this.targetRoom=null;this.age=0;this.roomAge=0;this.lastEnemyRoom=null;}
 hide(room){this.hiddenRoom=room;this.lastSeenRoom=room;this.targetRoom=room;this.age=0;this.roomAge=0;this.lastEnemyRoom=null;}
 emerge(){this.hiddenRoom=null;this.targetRoom=null;this.age=0;}
 update(dt,enemyRoom){
  if(this.hiddenRoom===null)return null;
  this.age+=dt;
  if(enemyRoom!==this.lastEnemyRoom){this.lastEnemyRoom=enemyRoom;this.roomAge=0;}else this.roomAge+=dt;
  if(enemyRoom===this.targetRoom&&this.roomAge>3.2){
   const choices=[enemyRoom-1,enemyRoom+1].filter(n=>n>=0&&n<=4);
   this.targetRoom=choices[Math.min(choices.length-1,Math.floor(this.random()*choices.length))];
   this.roomAge=0;
  }
  return this.targetRoom;
 }
}
