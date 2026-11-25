import {CHARACTER_DEFINITIONS} from './characters.js';

export function installCharacterSelector(onSelect) {
  const root=document.querySelector('#character-list');
  for(const [i,c] of CHARACTER_DEFINITIONS.entries()){
    const button=document.createElement('button');
    button.type='button';button.className='character-card';
    button.dataset.character=c.id;
    button.innerHTML=`<img src="${c.portrait}" alt=""><span class="character-copy"><small>${c.tag}</small><strong>${c.name}</strong></span>`;
    button.classList.toggle('selected',i===0);
    button.setAttribute('aria-pressed',String(i===0));
    root.append(button);
  }
  root.addEventListener('click',event=>{
    const card=event.target.closest('[data-character]');
    if(!card || card.getAttribute('aria-pressed')==='true')return;
    for(const button of root.children){
      button.classList.toggle('selected',button===card);
      button.setAttribute('aria-pressed',String(button===card));
    }
    onSelect(card.dataset.character);
  });
}
