// Each row describes a dispatch tier. Times are measured in simulated play seconds.
export const escalationSeconds = 20;
const tiers = [
  {cruisers:1, rocketInterval:0, rocketDamage:0, label:'LOCAL PATROL', blocks:0, airCover:false, coverSpeed:0, beamRadius:0, roadSpeed:21, footSpeed:7, marineSpeed:24, airSpeed:33, range:40, escape:8},
  {cruisers:2, rocketInterval:0, rocketDamage:0, label:'BACKUP', blocks:0, airCover:false, coverSpeed:0, beamRadius:0, roadSpeed:24, footSpeed:8, marineSpeed:28, airSpeed:37, range:43, escape:9},
  {cruisers:3, rocketInterval:5.4, rocketDamage:7, label:'ROADBLOCKS', blocks:1, airCover:false, coverSpeed:0, beamRadius:0, roadSpeed:27, footSpeed:9, marineSpeed:31, airSpeed:41, range:47, escape:10},
  {cruisers:5, rocketInterval:4.0, rocketDamage:9, label:'AIR WATCH', blocks:1, airCover:true, coverSpeed:24, beamRadius:12, roadSpeed:30, footSpeed:10, marineSpeed:34, airSpeed:45, range:51, escape:11},
  {cruisers:7, rocketInterval:2.8, rocketDamage:11, label:'CONTAINMENT', blocks:2, airCover:true, coverSpeed:29, beamRadius:17, roadSpeed:33, footSpeed:11, marineSpeed:37, airSpeed:49, range:55, escape:12},
];
export const responseFor = stars => tiers[Math.max(0, Math.min(4, stars-1))];
export function disablePatrol(unit) {
  unit.snackTime = unit.snackTime > 0 ? 16 : 8;
  unit.speed = 0;
  unit.way = null;
}
