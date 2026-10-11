export const STARTER_AMMO={
  "Javelin": "Javelins",
  "Throwing Knife": "Throwing Knives",
  "Shortbow": "Arrows",
  "Longbow": "Arrows",
  "Light Crossbow": "Bolts",
  "Heavy Crossbow": "Bolts",
  "Sling": "Sling Stones",
  "M4 Carbine": "5.56 NATO",
  "M16A4": "5.56 NATO",
  "L85A2": "5.56 NATO",
  "M249 SAW": "5.56 NATO",
  "AK-47": "7.62\u00d739",
  "FN SCAR-H": "7.62 NATO",
  "Remington 700": "7.62 NATO",
  "Barrett M82": ".50 BMG",
  "Glock 17": "9\u00d719",
  "Beretta 92": "9\u00d719",
  "MP5": "9\u00d719",
  "Uzi": "9\u00d719",
  "M1911": ".45 ACP",
  "Magnum Revolver": ".357 Magnum",
  "Mossberg 500": "12 gauge",
  "Benelli M4": "12 gauge",
  "Taser": "Taser Cartridges",
  "Flare Pistol": "Flares",
  "Gauss Rifle": "Gauss Rounds",
  "Rail Sniper": "Rail Slugs",
  "Toxin Dart Pistol": "Toxin Darts",
  "Pulse Rifle": "Pulse Charges",
  "Pulse Support Gun": "Pulse Charges",
  "Plasma Rifle": "Plasma Charges",
  "Heavy Laser Pistol": "Laser Charges",
  "Laser Pistol": "Laser Charges",
  "Laser Carbine": "Laser Charges",
  "Sonic Carbine": "Sonic Charges",
  "Energy Scattergun": "Scatter Charges",
  "Radiation Projector": "Radiation Charges",
  "Psi Focus Emitter": "Psi Charges",
  "Disruptor Pistol": "Disruptor Charges"
};
export async function migrateStarterAmmo(){
 if(!game.user.isGM||game.users?.activeGM&&game.users.activeGM.id!==game.user.id)return;
 const actors=[...game.actors,...game.scenes.contents.flatMap(s=>s.tokens.contents.filter(t=>!t.actorLink).map(t=>t.actor).filter(Boolean))];
 for(const item of [...game.items,...actors.flatMap(a=>a.items.contents)]){
  if(item.flags?.FUS?.balanceHP!==6)continue;
  const supplies={'Pistol Magazine':['9×19',15],'Rifle Magazine':['5.56 NATO',30],'Shotgun Shell Box':['12 gauge',10],'Gauss Magazine':['Gauss Rounds',20],'Universal Power Cell':['Laser Charges',30]};
  if(item.type==='item'&&!item.system.ammoType&&supplies[item.name]){const [ammo,units]=supplies[item.name];await item.update({'system.ammoType':ammo,'system.quantity':Number(item.system.quantity??1)*units,'system.description':`Compatible ammunition: ${ammo}. Quantity counts individual rounds or charges.`});}
  if(item.type==='weapon'&&!item.system.ammoType&&STARTER_AMMO[item.name])await item.update({'system.ammoType':STARTER_AMMO[item.name]});
  if(item.type==='item'&&item.name.includes('Rations (3 days)'))await item.update({name:item.name.replace('(3 days)','(1 day)'),'system.description':'One day of food for one character. Quantity counts days.'});
 }
}
