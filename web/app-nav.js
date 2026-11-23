'use strict';
function configureAppNav(apps={}) {
  const nav=document.querySelector('.app-nav');
  if(!nav)return;
  nav.querySelectorAll('[data-app]').forEach(link=>{
    const name=link.dataset.app;
    const current=name===nav.dataset.current;
    if(current){link.href='/';link.setAttribute('aria-current','page');link.removeAttribute('aria-disabled');}
    else if(apps[name]){link.href=apps[name];link.removeAttribute('aria-disabled');}
    else{link.removeAttribute('href');link.setAttribute('aria-disabled','true');link.title='Start both apps with start-both to switch here.';}
  });
}
