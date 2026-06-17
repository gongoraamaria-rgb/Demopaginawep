
(function(){
  function initGallery(){
    const gal = document.querySelector('[data-gallery]');
    if(!gal) return;
    const imgs = [
      ['fachada-color.jpg','Fachada principal'],
      ['fachada-color-2.jpg','Entrada escolar'],
      ['patio-cancha.jpg','Patio y cancha'],
      ['pasillo-cancha.jpg','Pasillo hacia cancha'],
      ['mesas-patio.jpg','Área de mesas'],
      ['aula-computo-2.png','Aula de cómputo'],
      ['porton-entrada.png','Portón de acceso'],
      ['plaza-entrada.png','Plaza escolar'],
      ['patio-01.jpg','Instalaciones']
    ];
    gal.innerHTML = imgs.map(([src,alt])=>`<img src="assets/images/${src}" alt="${alt}">`).join('');
  }
  document.addEventListener('DOMContentLoaded', initGallery);
})();
