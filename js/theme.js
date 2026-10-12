// Aplica el tema ANTES de que el navegador pinte la página (se carga en el
// <head>, sin defer), para que no haya un destello de otro color.
// Por decisión del artista el sitio arranca SIEMPRE en modo claro; solo
// pasa a oscuro si la persona lo eligió con el botón del encabezado.
(function () {
  var theme = 'light';
  try {
    if (localStorage.getItem('theme') === 'dark') theme = 'dark';
  } catch (e) { /* almacenamiento bloqueado: se queda en claro */ }
  document.documentElement.setAttribute('data-theme', theme);
})();
