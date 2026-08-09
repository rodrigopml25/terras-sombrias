#!/bin/bash
# Atualiza automaticamente a query string ?v=... de style.css e dos módulos
# logica-*.js referenciados nos HTMLs, usando um timestamp atual.
# Isso evita que o navegador de um jogador continue usando uma versão
# antiga em cache depois de um update no código.
#
# Uso manual:      ./scripts/bump-version.sh
# Uso automático:  já roda sozinho a cada commit (ver hooks/pre-commit)

set -e
cd "$(dirname "$0")/.."

VERSION=$(date +%Y%m%d%H%M%S)

for html in index.html jogador.html narrador.html; do
  if [ -f "$html" ]; then
    # cobre logica.js e qualquer módulo logica-nome.js, e style.css
    sed -i -E "s/(logica[-a-zA-Z]*\.js|style\.css)(\?v=[0-9A-Za-z]+)?/\1?v=$VERSION/g" "$html"
  fi
done

echo "Versão atualizada para v=$VERSION"
