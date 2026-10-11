import {loadSourceActions} from './action-library.mjs';
import {isFUSActor} from './actor-types.mjs';
import {chooseActionDamage} from './action-damage.mjs';
import {characterStats,healthAfterCapacityChange} from './health.mjs';
import {openSourceActions,availableActionGroups} from './attacks.mjs';
import {renderChatCard} from './chat-card.mjs';
import {inventoryGroups,quantity} from './inventory.mjs';
import {appliedForm, formMaximum, migrateFormData} from './forms.mjs';
import {SKILLS, SKILL_GROUPS, focusId, signed, focusLabel, nextFocusName} from "./config.mjs";
import {rollActor} from "./rolls.mjs";
import {memoryRows, memoryScore, parseTags, normalize, tagColour, tagStyle, serializeTags, enrichMemory} from "./memory.mjs";
import {setupTagEntry} from "./tag-entry.mjs";
import {numericInput} from "./numeric.mjs";
const {HandlebarsApplicationMixin} = foundry.applications.api;
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
export class FUSCharacterSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["fus-starter"], tag: "form",
    position: {width: 850, height: 650}, window: {resizable: true},
    form: {submitOnChange: true, closeOnSubmit: false},
    actions: {
      toggleUnavailable:FUSCharacterSheet.toggleUnavailable,openSourceItem:FUSCharacterSheet.onAction,useSourceAction:FUSCharacterSheet.onAction,weaponActions:FUSCharacterSheet.onAction,toggleArmourEquip:FUSCharacterSheet.onAction,rollInventoryDamage:FUSCharacterSheet.onAction,
      openForm: FUSCharacterSheet.onAction,
      adjustItemQuantity: FUSCharacterSheet.onAction,
      openInventoryItem: FUSCharacterSheet.onAction, removeInventoryItem: FUSCharacterSheet.onAction,
      toggleFocusControls: FUSCharacterSheet.toggleFocusControls,
      addFocus: FUSCharacterSheet.onAction, removeFocus: FUSCharacterSheet.onAction,
      addMemory: FUSCharacterSheet.onAction, editMemory: FUSCharacterSheet.onAction, removeMemory: FUSCharacterSheet.onAction,
      postMemory: FUSCharacterSheet.onAction, tagSettings: FUSCharacterSheet.onAction,
      searchTag: FUSCharacterSheet.onAction,
      portrait: FUSCharacterSheet.onAction, adjust: FUSCharacterSheet.onAction,
      roll: FUSCharacterSheet.onAction, selectSection: FUSCharacterSheet.selectSection
    }
  };
  static PARTS = {body: {template: "systems/FUS/templates/character-sheet.hbs", classes: ["fus-sheet"], scrollable: [".fus-panels", ".fus-sidebar"]}};
  _hideUnavailable=false;
  static async toggleUnavailable(){this._hideUnavailable=!this._hideUnavailable;await this.render({force:true});}
  _activeSection = "main";
  _search = "";
  _focusManagement = false;
  _memorySearch = "";
  _openMemories = new Set();
  _openInventory = new Set();
  _saveQueue = Promise.resolve();

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;
    await Promise.all(Array.from(this.document.items??[]).map(loadSourceActions));
    const selectedForm=appliedForm(this.document);
    const memories=memoryRows(system.memories, this._memorySearch, system.tagColours, this._openMemories);
    await Promise.all(memories.map(async entry=>{entry.contentHTML=await enrichMemory(entry.content,this.document);}));
    return {...context, actor: this.document, system, editable: this.isEditable, sheetId: this.id,
      hideUnavailable:this._hideUnavailable,
      actionGroups:availableActionGroups(this.document,{hideLocked:this._hideUnavailable}),
      health:characterStats(this.document),
      overview:{weapons:Array.from(this.document.items??[]).filter(i=>i.type==='weapon'&&(i.system.quantity??1)>0).map(i=>({name:i.name,resource:i.system.resourceMax>0?`${i.system.resourceCurrent}/${i.system.resourceMax}`:''})),armour:Array.from(this.document.items??[]).filter(i=>i.type==='armour'&&i.system.equipped&&(i.system.quantity??1)>0).map(i=>({name:i.name})),focuses:system.focuses.filter(f=>f.rank>0).sort((a,b)=>b.rank-a.rank).slice(0,6),memoryCount:(system.memories??[]).length,actionCount:availableActionGroups(this.document).reduce((n,g)=>n+g.actions.length,0)},
      skillGroups: this._skillGroups(),
      search: this._search,
      focusManagement: this._focusManagement,
      formDetails: selectedForm ? {...selectedForm.system, moveDisplay:selectedForm.system.move??'Not set'} : null,
      inventoryGroups: inventoryGroups(this.document,this._openInventory),
      inventoryRows: [...(this.document.items??[])].filter(item=>['item','weapon','armour'].includes(item.type)).map(item=>({id:item.id,name:item.name,img:item.img,description:item.system.description??'',typeLabel:{item:'Item',weapon:'Weapon',armour:'Armour'}[item.type]})).sort((a,b)=>a.name.localeCompare(b.name)),
      selectedFormName: selectedForm?.name ?? '',
      hasForm: Boolean(selectedForm),
      memorySearch: this._memorySearch,
      memoryRows: memories,
      skillAssigned: Object.values(system.skills).reduce((sum, rank) => sum + Math.max(0, rank), 0),
      focusAssigned: system.focuses.reduce((sum, focus) => sum + Math.max(0, focus.rank), 0),
      sections: ["main", "actions", "skills", "inventory", "memory", "notes"].map(id => ({id, label: id[0].toUpperCase() + id.slice(1), active: id === this._activeSection})),
      memoryActive: this._activeSection === "memory",
      actionsActive: this._activeSection === "actions",
            skillsActive: this._activeSection === "skills", mainActive: this._activeSection === "main", inventoryActive: this._activeSection === "inventory", notesActive: this._activeSection === "notes"
    };
  }
  async _onRender(context, options) {
    await super._onRender(context, options);
    const body = this.element.querySelector('[data-application-part="body"]') ?? this.element.querySelector(".fus-sheet");
    body?.classList.add("fus-sheet");
    const formDrop=this.element.querySelector('[data-form-drop]');
    if(this.isEditable) {
      formDrop?.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';});
      formDrop?.addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();this._dropForm(event).catch(error=>ui.notifications.error(error.message));});
    }
    const inventoryDrop=this.element.querySelector('[data-inventory-drop]');
    if(this.isEditable){
      inventoryDrop?.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';});
      inventoryDrop?.addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();this._dropInventoryItem(event).catch(error=>ui.notifications.error(error.message));});
    }
    for(const details of this.element.querySelectorAll('[data-inventory-details]')){
      details.addEventListener('toggle',()=>{if(details.open)this._openInventory.add(details.dataset.inventoryDetails);else this._openInventory.delete(details.dataset.inventoryDetails);});
    }
    for(const row of this.element.querySelectorAll('[data-inventory-item]')){
      row.addEventListener('dragstart',event=>{
        const item=[...(this.document.items??[])].find(item=>item.id===row.dataset.inventoryItem);
        if(!item)return;
        event.stopPropagation();event.dataTransfer.effectAllowed='copyMove';
        event.dataTransfer.setData('text/plain',JSON.stringify({type:'Item',uuid:item.uuid}));
      });
    }
    for(const input of this.element.querySelectorAll('[data-item-quantity]')){
      input.addEventListener('change',event=>{
        event.stopPropagation();const value=Number(input.value);
        if(input.value.trim()==='' || !Number.isSafeInteger(value) || value<0){input.value=input.defaultValue;return;}
        this._setItemQuantity(input.dataset.itemQuantity,value).catch(error=>ui.notifications.error(error.message));
      });
    }
    const search = this.element.querySelector("[data-skill-search]");
    search?.addEventListener("input", () => { this._search = search.value; this._filterSkills(); });
    // A search is a view control, not an Actor field.
    search?.addEventListener("change", event => event.stopPropagation());
    this._filterSkills();
    const memorySearch = this.element.querySelector("[data-memory-search]");
    memorySearch?.addEventListener("input", () => {this._memorySearch = memorySearch.value; this._filterMemories();});
    memorySearch?.addEventListener("change", event => event.stopPropagation());
    for (const entry of this.element.querySelectorAll("[data-memory-id]")) {
      entry.addEventListener("toggle", () => {
        if (entry.open) this._openMemories.add(entry.dataset.memoryId);
        else this._openMemories.delete(entry.dataset.memoryId);
      });
    }
    this._filterMemories();
    if (this.isEditable) for (const view of this.element.querySelectorAll('.fus-memory-view')) {
      view.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';});
      view.addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();this._dropOnMemory(event,view.closest('[data-memory-id]').dataset.memoryId).catch(error=>ui.notifications.error(error.message));});
    }
    for(const target of this.element.querySelectorAll('[data-action="useSourceAction"]'))target.addEventListener('dragstart',event=>{event.stopPropagation();event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('text/plain',JSON.stringify({type:'FUSAction',actorUuid:this.document.uuid,sourceId:target.dataset.itemId,actionId:target.dataset.sourceActionId}));});
    for (const target of this.element.querySelectorAll('[data-action="roll"]')) {
      target.addEventListener("dragstart", event => this._dragRoll(event, target));
    }
    for (const input of this.element.querySelectorAll("[data-numeric]")) {
      input.addEventListener("input", () => { input.dataset.numericDirty = "true"; });
    }
  }
  _processFormData(event, form, formData) {
    // Resolve signed entries against the saved Actor, then canonicalise the input
    // so a queued change plus an action submission cannot apply a delta twice.
    for (const input of form?.querySelectorAll("[data-numeric]") ?? []) {
      const path = input.name;
      const parts = path.split(".");
      let current = this.document;
      for (const part of parts) current = current[part];
      const unchanged = input.dataset.numericDirty !== "true" && input.value === input.defaultValue;
      const value = unchanged ? Number(current) : numericInput(input.value, current);
      formData.object[path] = value;
      input.value = String(value);
      input.defaultValue = input.value;
      delete input.dataset.numericDirty;
    }
    const data = super._processFormData(event, form, formData);
    data.system ??= {};
    // All tabs remain in the form, including hidden panels.
    data.system.focuses = Object.values(data.system.focuses ?? {});
    // All memories remain in the form even when collapsed or filtered out.
    data.system.memories = Object.values(data.system.memories ?? {});
    const maximum=formMaximum(this.document);
    if(maximum!==null)data.system.maxhp=maximum;
    if (Number.isFinite(data.system.hp) && Number.isFinite(data.system.maxhp)) data.system.hp = Math.min(data.system.hp, characterStats(this.document,{baseHP:data.system.maxhp}).maximum);
    return data;
  }
  async _processSubmitData(event, form, submitData, options) {
    // Preserve order when several change events arrive before the database responds.
    const save = this._saveQueue.catch(() => {}).then(() => super._processSubmitData(event, form, submitData, options));
    this._saveQueue = save;
    return save;
  }
  async _dropInventoryItem(event){
    if(!this.isEditable || this._inventoryBusy)return;
    this._inventoryBusy=true;
    try{
    const data=foundry.applications.ux.TextEditor.getDragEventData(event);
    const item=await foundry.documents.Item.fromDropData(data);
    if(!['item','weapon','armour'].includes(item?.type)){ui.notifications.warn('Drop an Item, Weapon or Armour here.');return;}
    await this.submit();
    if(isFUSActor(item.parent)){
      if(item.parent.uuid===this.document.uuid)return;
      return await this._transferInventoryItem(item);
    }
    return await this._copyInventoryItem(item);
    }finally{this._inventoryBusy=false;}
  }
  async _setItemQuantity(id,value){
    if(!this.isEditable || !Number.isSafeInteger(value) || value<0)return;
    const item=[...(this.document.items??[])].find(item=>item.id===id && ['item','weapon','armour'].includes(item.type));
    if(item)await item.update({'system.quantity':value});
  }
  async _transferInventoryItem(item){
    if(!this.isEditable || !item.parent?.isOwner || !['item','weapon','armour'].includes(item.type)){
      ui.notifications.warn('You need ownership of both characters to move items.');return;
    }
    const available=quantity(item);if(available===0)return;
    const amount=await foundry.applications.api.DialogV2.wait({window:{title:'Move item'},content:`<p>Move ${escapeHTML(item.name)} to ${escapeHTML(this.document.name)}?</p><label>Quantity <input name="quantity" type="number" min="1" max="${available}" step="1" value="${available}" required></label>`,buttons:[{action:'cancel',label:'Cancel'},{action:'move',label:'Move',default:true,callback:(_event,button)=>Number(button.form.elements.quantity.value)}],rejectClose:false});
    if(!Number.isSafeInteger(amount) || amount<1 || amount>quantity(item))return;
    const source=item.parent;if(!source.isOwner || !this.isEditable)return;
    const owned=await this._copyInventoryItem(item,amount);
    if(!owned)return;
    try{
      const remaining=quantity(item)-amount;
      if(remaining<0)throw new Error('The source quantity changed. Try again.');
      if(remaining===0)await source.deleteEmbeddedDocuments('Item',[item.id]);
      else await item.update({'system.quantity':remaining});
    }catch(error){
      await this.document.deleteEmbeddedDocuments('Item',[owned.id]);throw error;
    }
    return owned;
  }
  async _copyInventoryItem(item,amount=quantity(item)){
    if(!this.isEditable || !['item','weapon','armour'].includes(item?.type))return;
    const source=item.toObject();delete source._id;source.folder=null;
    source.system.quantity=amount;
    source.flags??={};source.flags.core??={};source.flags.core.sourceId=item.uuid;
    const [owned]=await this.document.createEmbeddedDocuments('Item',[source]);
    return owned;
  }
  async _removeInventoryItem(id){
    if(!this.isEditable)return;
    const item=[...(this.document.items??[])].find(item=>item.id===id && ['item','weapon','armour'].includes(item.type));
    if(!item)return;
    const confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:'Remove item'},content:`<p>Remove ${escapeHTML(item.name)} from this character?</p>`,rejectClose:false});
    if(confirmed)await this.document.deleteEmbeddedDocuments('Item',[id]);
  }
  async _dropForm(event){
    if(!this.isEditable)return;
    const data=foundry.applications.ux.TextEditor.getDragEventData(event);
    const item=await foundry.documents.Item.fromDropData(data);
    if(item?.type!=='form'){ui.notifications.warn('Drop a Form item here.');return;}
    await this.submit();
    return this._assignForm(item);
  }
  async _removeForm(){throw new Error('An actor must always have a Form. Replace it with another Form.');}
  async _assignForm(item){
    if(!this.isEditable || item?.type!=='form')return;
    let owned=[...(this.document.items??[])].find(owned=>owned.type==='form' && (owned.uuid===item.uuid || owned.getFlag?.('core','sourceId')===item.uuid));
    if(!owned){
      const source=migrateFormData(item.toObject());delete source._id;source.folder=null;
      if(source.system.maxhp==null)source.system.maxhp=this.document._source?.system.maxhp??this.document.system.maxhp??0;
      source.flags??={};source.flags.core??={};source.flags.core.sourceId=item.uuid;
      [owned]=await this.document.createEmbeddedDocuments('Item',[source]);
    }
    const previous=appliedForm(this.document),beforeMaximum=characterStats(this.document).maximum;
    if(owned){
      if(owned.system.maxhp==null)await owned.update({'system.maxhp':this.document._source?.system.maxhp??this.document.system.maxhp??0});
      const maximum=owned.system.maxhp;
      await this.document.update({'system.formItemId':owned.id,'system.maxhp':maximum,'system.hp':healthAfterCapacityChange(this.document.system.hp??0,beforeMaximum,characterStats(this.document,{baseHP:maximum}).maximum)});
    }
    if(previous && owned && previous.id!==owned.id)await this.document.deleteEmbeddedDocuments('Item',[previous.id]);
    return owned;
  }
  _skillGroups() {
    const system = this.document.system;
    return SKILL_GROUPS.map(group => ({...group, rows: group.keys.map(key => ({
      key, label: SKILLS[key], rank: system.skills[key],
      focuses: system.focuses.map((focus, index) => ({...focus, index, id: focusId(focus, index), displayName: focusLabel(focus), defaultName: focus.defaultName ?? "",
        total: signed(system.skills[key] + focus.rank)
      })).filter(focus => focus.skill === key)
    }))}));
  }
  _filterSkills() {
    const query = this._search.trim().toLocaleLowerCase();
    for (const row of this.element.querySelectorAll("[data-skill]")) {
      const parentMatch = row.dataset.label.toLocaleLowerCase().includes(query);
      let childMatch = false;
      for (const focus of row.querySelectorAll("[data-focus-label]")) {
        const matches = parentMatch || focus.dataset.focusLabel.toLocaleLowerCase().includes(query);
        focus.hidden = !matches;
        childMatch ||= matches;
      }
      row.hidden = !parentMatch && !childMatch;
    }
    let visible = false;
    for (const group of this.element.querySelectorAll("[data-skill-category]")) {
      group.hidden = ![...group.querySelectorAll("[data-skill]")].some(row => !row.hidden);
      visible ||= !group.hidden;
    }
    const empty = this.element.querySelector(".fus-no-results");
    if (empty) empty.hidden = visible;
  }
  _dragRoll(event, target) {
    if (!this.isEditable) { event.preventDefault(); return; }
    const {kind, key, index} = target.dataset;
    const focus = this.document.system.focuses[Number(index)];
    const payload = {type: "FUSRoll", actorUuid: this.document.uuid, kind,
      ...(kind === "skill" ? {key} : {focusId: focusId(focus, Number(index))})};
    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "copy";
  }
  async _focusDialog(index,draft) {
    const original = draft ?? this.document.system.focuses[index];
    if (!original) return;
    const id = focusId(original, index);
    const options = Object.entries(SKILLS).map(([key, label]) => `<option value="${key}" ${key === original.skill ? "selected" : ""}>${escapeHTML(label)}</option>`).join("");
    const sheet = this;
    await new foundry.applications.api.DialogV2({
      window: {title: original.name ? "Edit focus" : "New focus"}, modal: true, position: {width: 380},
      content: `<div class="fus-editor-form"><label>Name <input name="focusName" title="Focus name" value="${escapeHTML(original.name)}" placeholder="${escapeHTML(original.defaultName || 'Focus name')}" autofocus></label>
        <div class="fus-editor-fields"><label>Parent skill <select name="skill" title="Parent skill">${options}</select></label>
        <label>Bonus <input name="rank" title="Focus bonus; + or - adjusts it" type="text" inputmode="decimal" value="${original.rank}"></label></div></div>`,
      buttons: [
        {action: "submit", label: "Submit", tooltip: "Save focus", default: true, callback: (event, button) => {
          const fields = button.form.elements;
          if(draft)return sheet._createFocus(draft,{name:fields.focusName.value,skill:fields.skill.value,rank:fields.rank.value});
          return sheet._changeFocus(id, {action: "submit", name: fields.focusName.value,
            skill: fields.skill.value,  rank: fields.rank.value, originalRank: original.rank});
        }}
      ]
    }).render({force: true});
  }
  async _createFocus(draft,values){
    if(!this.isEditable || !Object.hasOwn(SKILLS,values.skill))return;
    await this._saveQueue;
    const rank=numericInput(values.rank,0);
    const focuses=this.document.system.focuses.map(focus=>({...focus}));
    const defaultName=nextFocusName(focuses,this.document.system.focusCounter??0);
    focuses.push({...draft,name:values.name,skill:values.skill,rank,defaultName});
    await this.document.update({'system.focuses':focuses,'system.focusCounter':Number(/\((\d+)\)$/.exec(defaultName)[1])});
  }
  _focusSaveQueue = Promise.resolve();
  _changeFocus(id, change) {
    const save = this._focusSaveQueue.catch(() => {}).then(async () => {
      if (!this.isEditable) return;
      await this._saveQueue;
      const focuses = this.document.system.focuses.map((f,i) => ({...f, id: focusId(f,i)}));
      const index = focuses.findIndex(focus => focus.id === id);
      if (index < 0) return;
      if (change.action === "delete") {
        focuses.splice(index, 1);
      } else if (change.action === "submit") {
        if (!Object.hasOwn(SKILLS, change.skill)) throw new Error("Choose a valid parent skill.");
        const rank = change.rank === String(change.originalRank) ? focuses[index].rank : numericInput(change.rank, focuses[index].rank);
        focuses[index] = {...focuses[index], name: change.name, skill: change.skill, rank};
      } else return;
      await this.document.update({"system.focuses": focuses});
    });
    this._focusSaveQueue = save;
    return save;
  }
  async _confirmFocusRemoval(index) {
    const focus = this.document.system.focuses[index];
    if (!focus) return;
    const id = focusId(focus,index);
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: {title: "Remove focus?"}, modal: true, rejectClose: false,
      content: `<p>Are you sure you want to remove <strong>${escapeHTML(focusLabel(focus))}</strong>?</p>`,
      yes: {label: "Remove"}, no: {label: "Cancel"}
    });
    if (confirmed) await this._changeFocus(id,{action: "delete"});
  }
  _filterMemories() {
    const list=this.element.querySelector(".fus-memory-list");
    if(!list)return;
    const rows=[...list.querySelectorAll("[data-memory-id]")].map(entry=>{
      const index=Number(entry.dataset.index);
      const field=key=>entry.querySelector(`[name="system.memories.${index}.${key}"]`)?.value??'';
      const title=field('title'), score=memoryScore({title,content:field('content'),tags:field('tags')},this._memorySearch);
      entry.hidden=score===0;
      return {entry,title,score,index};
    }).sort((a,b)=>(this._memorySearch.trim()?b.score-a.score:0)||a.title.localeCompare(b.title,undefined,{sensitivity:'base',numeric:true})||a.index-b.index);
    for(const row of rows)list.append(row.entry);
    const empty=this.element.querySelector('.fus-memory-empty');
    if(empty){empty.hidden=rows.some(row=>!row.entry.hidden);empty.textContent=rows.length?'No matching memories.':'No memories yet. Add your first entry.';}
  }
  async _memoryAction(action,index) {
    const memories=(this.document.system.memories??[]).map(entry=>({...entry}));
    if(action==='addMemory') {
      await this._memoryDialog();return;
    }
    const memory=memories[index];if(!memory)return;
    if(action==='editMemory') {await this._memoryDialog(memory);return;}
    if(action==='removeMemory') {
      const confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:'Remove memory?'},modal:true,rejectClose:false,
        content:`<p>Are you sure you want to remove <strong>${escapeHTML(memory.title||'Untitled memory')}</strong>?</p>`,yes:{label:'Remove'},no:{label:'Cancel'}});
      if(!confirmed)return;
      // Resolve again by stable ID after waiting for the confirmation.
      const latest=(this.document.system.memories??[]).filter(entry=>entry.id!==memory.id).map(entry=>({...entry}));
      this._openMemories.delete(memory.id);await this.document.update({'system.memories':latest});
    } else if(action==='postMemory') {
      const tags=this._tagBoxes(memory.tags);
      const content=await enrichMemory(memory.content,this.document);
      await foundry.documents.ChatMessage.create({speaker:foundry.documents.ChatMessage.getSpeaker({actor:this.document}),
        content:await renderChatCard({title:memory.title||'Untitled memory',bodyHTML:`${tags?`<div class="fus-tags">${tags}</div>`:''}${content}`})});
    }
  }
  _tagBoxes(tags) {
    return parseTags(tags).map(tag=>`<span class="fus-tag" style="display:inline-block;border-radius:.25rem;padding:.15rem .4rem;margin:.15rem;${tagStyle(tag,this.document.system.tagColours)}">${escapeHTML(tag)}</span>`).join('');
  }
  async _memoryDialog(original,reference) {
    const draft=original?{...original}:{id:foundry.utils.randomID(),title:'',content:'',tags:''};
    if(reference)draft.content+=(draft.content?'\n':'')+reference;
    const sheet=this;
    class MemoryEditor extends foundry.applications.api.DialogV2 {
      async _onRender(context,options) {
        await super._onRender(context,options);
        setupTagEntry(this.element,sheet.document.system.tagColours);
        const body=this.element.querySelector('[name="entryContent"]');
        body.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';});
        body.addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();sheet._dropMemoryReference(event,body).catch(error=>ui.notifications.error(error.message));});
      }
    }
    await new MemoryEditor({window:{title:original?'Edit memory':'New memory'},modal:true,position:{width:520},
      content:`<div class="fus-editor-form"><label>Title <input name="memoryTitle" title="Memory title" type="text" value="${escapeHTML(draft.title)}" placeholder="Untitled memory" autofocus></label>
        <label>Tags <div class="fus-tag-entry"><input name="tags" type="hidden" value="${escapeHTML(draft.tags)}"><span class="fus-tag-boxes"></span><input data-tag-entry type="text" placeholder="Add tag" aria-label="Add tag" title="Type a tag; space or comma adds it."></div></label>
        <label>Entry <textarea name="entryContent" title="Memory text; drop a document to reference it" rows="12" placeholder="Write a memory or drag a document here.">${escapeHTML(draft.content)}</textarea></label></div>`,
      buttons:[{action:'cancel',label:'Cancel',tooltip:'Discard changes'},{action:'submit',label:'Submit',tooltip:'Save memory',default:true,callback:(event,button)=>{
        const fields=button.form.elements;
        return sheet._saveMemory({...draft,title:fields.memoryTitle.value,content:fields.entryContent.value,tags:serializeTags(parseTags(fields.tags.value))},Boolean(original));
      }}]
    }).render({force:true});
  }
  async _saveMemory(draft,existing) {
    if(!this.isEditable)return;
    await this._saveQueue;
    const memories=(this.document.system.memories??[]).map(entry=>({...entry}));
    const index=memories.findIndex(entry=>entry.id===draft.id);
    if(existing && index<0){ui.notifications.warn('This memory no longer exists.');return;}
    if(index<0)memories.push(draft);else memories[index]=draft;
    this._openMemories.add(draft.id);this._memorySearch='';
    await this.document.update({'system.memories':memories});
  }
  async _dropOnMemory(event,id) {
    if(!this.isEditable || this._fusBusy)return;
    this._fusBusy=true;
    try {
      const editor=foundry.applications.ux.TextEditor;
      const link=await editor.getContentLink(editor.getDragEventData(event),{relativeTo:this.document});
      if(!link){ui.notifications.warn('Drag a document, item, character or journal page here.');return;}
      await this.submit();
      const memory=(this.document.system.memories??[]).find(entry=>entry.id===id);
      if(memory)await this._memoryDialog(memory,link);
    } finally {this._fusBusy=false;}
  }
  async _dropMemoryReference(event,textarea) {
    const editor=foundry.applications.ux.TextEditor;
    const data=editor.getDragEventData(event);
    const link=await editor.getContentLink(data,{relativeTo:this.document});
    if(!link){ui.notifications.warn('Drag a document, item, character or journal page here.');return;}
    const start=textarea.selectionStart??textarea.value.length,end=textarea.selectionEnd??start;
    textarea.value=textarea.value.slice(0,start)+link+textarea.value.slice(end);
    textarea.focus();textarea.setSelectionRange(start+link.length,start+link.length);
    textarea.dispatchEvent(new Event('input',{bubbles:true}));
  }
  async _tagSettings() {
    const system=this.document.system;
    const tags=[...new Map((system.memories??[]).flatMap(entry=>parseTags(entry.tags)).map(tag=>[normalize(tag),tag])).values()].sort((a,b)=>a.localeCompare(b));
    if (!tags.length) {ui.notifications.info("Create a tag on a note first!");return;}
    const current=system.tagColours??[];
    const content='<div class="fus-tag-settings-grid">'+tags.map((tag,i)=>`<div class="fus-tag-setting"><span>${escapeHTML(tag)}</span><input aria-label="${escapeHTML(tag)} colour" title="Choose tag colour" data-colour-index="${i}" name="colour${i}" type="color" value="${tagColour(tag,current)}"><label><input type="checkbox" title="Use generated colour" name="auto${i}" ${current.some(entry=>normalize(entry.tag)===normalize(tag))?'':'checked'}> Automatic</label></div>`).join('')+'</div>';
    const sheet=this;
    class TagSettings extends foundry.applications.api.DialogV2 {
      async _onRender(context,options){
        await super._onRender(context,options);
        for(const colour of this.element.querySelectorAll('[data-colour-index]')) {
          const manual=()=>{this.element.querySelector(`[name="auto${colour.dataset.colourIndex}"]`).checked=false;};
          colour.addEventListener('input',manual);colour.addEventListener('change',manual);
        }
      }
    }
    await new TagSettings({window:{title:'Memory tag colours'},modal:true,position:{width:760},content,
      buttons:[{action:'cancel',label:'Cancel',tooltip:'Discard changes'},{action:'submit',label:'Submit',tooltip:'Save tag colours',default:true,callback:async(event,button)=>{
        if(!sheet.isEditable)return;
        const settings=tags.flatMap((tag,i)=>button.form.elements[`auto${i}`].checked?[]:[{tag,colour:button.form.elements[`colour${i}`].value}]);
        await sheet.document.update({'system.tagColours':settings});
      }}]
    }).render({force:true});
  }
  static toggleFocusControls(event,target){
    if(!this.isEditable)return;
    this._focusManagement=!this._focusManagement;
    this.element.querySelector('[data-panel="skills"]')?.classList.toggle('fus-managing-focuses',this._focusManagement);
    target.setAttribute('aria-pressed',String(this._focusManagement));
  }
  static selectSection(event, target) {
    const section = target.dataset.section;
    if (!["main", "actions", "skills", "inventory", "memory", "notes"].includes(section)) return;
    this._activeSection = section;
    // Toggle existing panels without rebuilding the form or losing pending text edits.
    for (const button of this.element.querySelectorAll('[data-action="selectSection"]')) {
      const active = button.dataset.section === section;
      button.setAttribute("aria-selected", String(active));
      button.classList.toggle("active", active);
    }
    for (const panel of this.element.querySelectorAll("[data-panel]")) panel.hidden = panel.dataset.panel !== section;
  }
  async _roll(kind, key, index) {
    return rollActor(this.document, {kind, key, focusId: kind === "focus" && this.document.system.focuses[index] ? focusId(this.document.system.focuses[index], index) : undefined});
  }
  static async onAction(event, target) {
    if(target.dataset.action==='openSourceItem'){const item=[...(this.document.items??[])].find(i=>i.id===target.dataset.itemId);if(item)await item.sheet.render({force:true});return;}
    if(!this.isEditable && target.dataset.action==='openInventoryItem'){
      const item=[...(this.document.items??[])].find(item=>item.id===target.dataset.itemId && ['item','weapon','armour'].includes(item.type));
      if(item)await item.sheet.render({force:true});
      return;
    }
    if (!this.isEditable || this._fusBusy) return;
    this._fusBusy = true;
    try {
      event.preventDefault?.();
      event.stopPropagation?.();
      const {action, kind, key} = target.dataset;
      if((action === "addFocus" || action === "removeFocus") && !this._focusManagement)return;
      const index = Number(target.dataset.index);
      if (!this.element.reportValidity()) return;
      await this.submit();
      const system = this.document.system;
      if(action==='useSourceAction'){
        const weapon=[...(this.document.items??[])].find(i=>i.id===target.dataset.itemId && (['weapon','form'].includes(i.type)) && (i.system.quantity??1)>0);
        if(weapon)await openSourceActions(this.document,weapon,target.dataset.sourceActionId,{force:!!event.shiftKey,skipTarget:!!event.shiftKey});
      } else if(action==='weaponActions'){
        const weapon=[...(this.document.items??[])].find(i=>i.id===target.dataset.itemId && i.type==='weapon');
        if(weapon)await openSourceActions(this.document,weapon);
      } else if(action==='toggleArmourEquip'){
        const item=[...(this.document.items??[])].find(item=>item.id===target.dataset.itemId && item.type==='armour');
        if(item)await item.update({'system.equipped':!item.system.equipped});
      } else if(action==='rollInventoryDamage'){
        const item=[...(this.document.items??[])].find(item=>item.id===target.dataset.itemId && item.type==='weapon');
        if(item)await chooseActionDamage(this.document,item);
      } else if(action==='adjustItemQuantity'){
        const item=[...(this.document.items??[])].find(item=>item.id===target.dataset.itemId && ['item','weapon','armour'].includes(item.type));
        if(item)await this._setItemQuantity(item.id,Math.max(0,quantity(item)+Number(target.dataset.delta)));
      } else if(action==='openInventoryItem'){
        const item=[...(this.document.items??[])].find(item=>item.id===target.dataset.itemId && ['item','weapon','armour'].includes(item.type));
        if(item)await item.sheet.render({force:true});
      } else if(action==='removeInventoryItem'){
        await this._removeInventoryItem(target.dataset.itemId);
      } else if(action==='removeForm'){
        await this._removeForm();
      } else if (action === "openForm") {
        const item=this.document.items?.get(system.formItemId);
        if(item?.type==='form')await item.sheet.render({force:true});
      } else if (action === "portrait") {
        await new foundry.applications.apps.FilePicker.implementation({
          type: "image", current: this.document.img,
          callback: path => this.document.update({img: path})
        }).browse();
      } else if (action === "removeFocus") {
        await this._confirmFocusRemoval(index);
      } else if (action === "addMemory" || action === "editMemory" || action === "removeMemory" || action === "postMemory") {
        await this._memoryAction(action,index);
      } else if (action === "tagSettings") {
        await this._tagSettings();
      } else if (action === "searchTag") {
        this._memorySearch = `tag:"${target.dataset.tag.replaceAll('"','')}"`;
        const search=this.element.querySelector('[data-memory-search]');if(search)search.value=this._memorySearch;
        this._filterMemories();
      } else if (action === "roll") {
        if (kind === "focus" && event.shiftKey) await this._focusDialog(index);
        else await this._roll(kind, key, index);
      } else if (action === "addFocus") {
        if(!Object.hasOwn(SKILLS,key))return;
        await this._focusDialog(undefined,{id:foundry.utils.randomID(),name:'',defaultName:nextFocusName(system.focuses,system.focusCounter??0),skill:key,rank:0});
      } else if (action === "adjust" && kind === "focus") {
        const focuses=system.focuses.map(focus=>({...focus}));
        if(!Number.isInteger(index)||index<0||index>=focuses.length)return;
        const delta=Number(target.dataset.delta);if(delta!==1&&delta!==-1)return;
        focuses[index].rank+=delta;
        await this.document.update({'system.focuses':focuses});
      } else if (action === "adjust") {
        const delta = Number(target.dataset.delta);
        if (delta !== 1 && delta !== -1) return;
        const group = kind === "skill" ? "skills" : null;
        const config = SKILLS;
        if (!group || !Object.hasOwn(config, key)) return;
        await this.document.update({[`system.${group}.${key}`]: system[group][key] + delta});
      }
    } catch (error) {
      ui.notifications.error(error.message);
      console.error("FUS character sheet", error);
    } finally { this._fusBusy = false; }
  }
}
