# super-productivity-water-reminder

Plugin para o [Super Productivity](https://github.com/super-productivity/super-productivity) que lembra você de beber água. Defina a meta diária em ml, o tamanho do copo e os horários inicial e final; os lembretes são distribuídos ao longo do dia, com registro em um clique.

Desenvolvido contra a API de plugins da versão 20.1.0 (`minSupVersion: 20.1.0`).

## Recursos

- Item **Água** no menu lateral esquerdo, que abre o plugin na área principal do app.
- Meta diária (ml), tamanho do copo, **hora inicial** e **hora final**.
- Lembretes distribuídos igualmente entre a hora inicial e a final (`ceil(meta / copo)` lembretes). Cada um aparece como notificação e como aviso com o botão `+ copo`.
- Progresso do dia, desfazer último copo, quantidade avulsa e histórico dos últimos 7 dias.
- Atalho **Água: registrar um copo** (a tecla é definida nas configurações de atalhos do app).
- Traduções em inglês (`en`) e português do Brasil (`pt-br`).

## Instalação

1. Baixe `water-reminder.zip` na página de [Releases](../../releases).
2. No Super Productivity, abra **Settings → Plugins → Choose Plugin File** e selecione o ZIP.
3. Ative o plugin e clique em **Água** no menu lateral esquerdo.

Teste primeiro em uma instância de testes (https://test-app.super-productivity.com/), não nos seus dados reais.

## Uso

Na tela do plugin, ajuste a meta, o copo e o intervalo em **Configuração** e clique em **Salvar**. O bloco **Horários dos lembretes** mostra quando os avisos vão acontecer. Use o botão `+ copo` para registrar o consumo, ou responda diretamente ao aviso do lembrete.

## Desenvolvimento

```
manifest.json     metadados, permissões e idiomas (i18n.languages)
plugin.js         lado host: lembretes (timer de 1 min), item de menu, atalho
index.html        interface (CSS e JS inline), roda em iframe na área principal
icon.svg          ícone
i18n/en.json      textos em inglês (fonte da verdade)
i18n/pt-br.json   textos em português do Brasil
scripts/build.py  valida traduções e gera dist/water-reminder.zip
```

Para gerar o ZIP instalável:

```bash
python3 scripts/build.py
```

O script confere se todos os idiomas têm as mesmas chaves e placeholders `{{x}}`, se as chaves usadas no código existem em `en.json`, atualiza o fallback em inglês embutido no `index.html` e gera `dist/water-reminder.zip` com os arquivos na raiz.

### Adicionar um idioma

1. Copie `i18n/en.json` para `i18n/<codigo>.json` (código em minúsculas, ex.: `es`, `pt-br`).
2. Traduza só os valores, mantendo as chaves e os `{{placeholders}}`.
3. Inclua o código em `i18n.languages` no `manifest.json` e rode o build.

Se o idioma do app não tiver tradução, o plugin usa o inglês.

## Dados e privacidade

- Configuração e consumo ficam em `persistDataSynced` (chaves `config` e `log`) e são sincronizados com o restante dos dados do app. Os últimos 60 dias de consumo são mantidos.
- O último lembrete enviado fica em `setSecret`, local a cada dispositivo e nunca sincronizado, para não repetir o aviso do mesmo horário.
- O plugin não usa rede (`permissions: []` e `dataSharing: []`).

## Limitações

- O intervalo precisa estar dentro do mesmo dia (hora final depois da inicial).
- Os lembretes só disparam com o app aberto. Ao abrir tarde, o plugin avisa apenas do último horário já passado, e não de todos os perdidos.
- A API de plugins não permite agendar notificações em segundo plano.
- Com vários dispositivos abertos, cada um envia seu próprio lembrete.

## Publicar uma nova versão

1. Altere `version` no `manifest.json` (ex.: `1.0.2` para `1.0.3`). Use só números separados por pontos.
2. Gere o ZIP e anote o hash que o script imprime:

   ```bash
   python3 scripts/build.py
   ```

3. Faça o commit e crie a tag da versão:

   ```bash
   git add -A
   git commit -m "release: v1.0.3"
   git tag v1.0.3
   git push && git push --tags
   ```

4. No GitHub, abra **Releases → Draft a new release**, escolha a tag `v1.0.3` e anexe `dist/water-reminder.zip`. Se usar o GitHub CLI:

   ```bash
   gh release create v1.0.3 dist/water-reminder.zip --title "v1.0.3" --notes "Descrição das mudanças"
   ```

5. Para atualizar no Super Productivity, instale o novo ZIP em **Settings → Plugins → Choose Plugin File**. Se o app recusar por já existir o plugin, desinstale a versão antiga e instale de novo.

Se o plugin estiver na lista da comunidade do app, abra também um PR em `src/assets/community-plugins.json` do repositório do Super Productivity, atualizando `version`, `downloadUrl` e `sha256` do `release`. A `version` deve ser igual à do `manifest.json`.

## Licença

[MIT](LICENSE) © [vinimeurer](https://github.com/vinimeurer)
