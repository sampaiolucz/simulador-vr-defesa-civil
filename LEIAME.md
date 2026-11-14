# Simulador VR — Defesa Civil de Cubatão

Simulador de emergências em realidade virtual para palestras, feito para o **Meta Quest 2**.
Funciona com **as mãos** (gesto de pinça) **ou com os controles**, e roda **sem internet** depois de instalado.

## Cenário disponível: Incêndio residencial (5 a 8 minutos)

| Fase | O que a pessoa faz | O que aprende |
|---|---|---|
| 1. Prevenção | Procura 6 riscos pela casa (cozinha e sala) | Cabo de panela, álcool perto do fogão, benjamim sobrecarregado, botijão/mangueira, vela perto da cortina, isqueiro ao alcance de crianças |
| 2. Fogo na panela | Escolhe o que fazer: botões do fogão, tampa, jarra d'água, levar a panela à pia | Desligar o gás e abafar; **nunca jogar água no óleo** (a simulação mostra a bola de fogo) |
| 3. Fuga | Acorda com o alarme, fumaça descendo do teto, duas portas | Abaixar-se na fumaça (a altura da fumaça se ajusta a cada pessoa), sentir a porta com o dorso da mão, não parar para pegar objetos |
| 4. Pedir socorro | Escolhe o número e o que dizer | 193 para incêndio; informar o endereço e um ponto de referência; nunca voltar para dentro |

No fim aparece a **pontuação** e os pontos para revisar, o que é bom para puxar conversa com o público.
Na tela inicial dá para **começar direto de uma fase** quando a palestra tiver pouco tempo.

> ⚠️ **Antes de usar com o público:** peça para a equipe técnica (Defesa Civil / Bombeiros) revisar os textos.
> Todos os textos educativos estão em um único arquivo: `js/scenario-incendio.js`.

---

## Como colocar no Quest 2

O WebXR (VR pelo navegador) só funciona em endereço **https://** ou **localhost**. Por isso existem duas formas:

### Opção A (recomendada): hospedar uma vez e usar offline

1. Publique a pasta `simulador-vr-defesa-civil` num site gratuito com https, como o **GitHub Pages** ou o **Netlify**
   (é só enviar a pasta inteira; não precisa instalar nada).
2. No Quest 2, **com internet**, abra o endereço no navegador (Meta Quest Browser).
3. Na tela inicial deve aparecer em verde: **“✔ Pronto para funcionar sem internet neste aparelho”**.
4. Salve o endereço nos favoritos.
5. **Teste offline:** desligue o Wi-Fi do óculos e abra o favorito. Precisa funcionar normalmente.

Dica: abra o simulador com internet **um dia antes de cada evento** para garantir que a cópia offline está atualizada.
O navegador pode apagar a cópia se o óculos ficar sem espaço ou muito tempo sem abrir o simulador.

### Opção B (reserva 100% offline): notebook + cabo USB

Use se não houver internet nem para a preparação. Requer o **modo desenvolvedor** do Quest ativado (é feito uma vez,
pelo aplicativo Meta Horizon no celular) e o `adb` (Android Platform Tools) no notebook.

1. No notebook, dê dois cliques em `iniciar-servidor.bat` (precisa do Python instalado).
2. Conecte o Quest no notebook com o cabo USB e aceite a permissão de depuração que aparece no óculos.
3. No notebook, rode: `adb reverse tcp:8080 tcp:8080`
4. No navegador do Quest, abra: `http://localhost:8080`

---

## Configurar o rastreamento de mãos no Quest 2

1. **Configurações → Rastreamento de movimento → Rastreamento de mãos** (o nome do menu muda um pouco conforme a versão do sistema): ative.
2. Ative também **“Alternar automaticamente entre mãos e controles”**: basta largar os controles que o óculos passa a usar as mãos.
3. No simulador: **aponte com a mão** (aparece uma linha) e **junte o polegar e o indicador** para selecionar.

O rastreamento de mãos funciona melhor em **ambiente bem iluminado**, sem sol direto e sem luzes piscando.

## Usar no computador ou no telão

Dê dois cliques em `iniciar-servidor.bat` e clique em **“Testar no computador”**.
Arraste com o mouse para olhar, clique para selecionar, use **C** para abaixar/levantar e **R** para reiniciar.
É útil para ensaiar a palestra ou projetar enquanto alguém usa o óculos.

## Dicas para as palestras

- **Sessões curtas** (uma rodada completa leva de 5 a 8 minutos). Ninguém anda com joystick, a movimentação é por teletransporte, o que reduz o enjoo.
- Peça para a pessoa ficar **em pé, num espaço livre de 2 × 2 m**. Na fase de fuga ela vai precisar se agachar de verdade.
- **Higiene:** tenha lenços higienizadores e, se possível, capas faciais descartáveis.
- **Espelhar no telão:** pelo próprio Quest (botão Compartilhar → Transmitir) para uma TV/Chromecast, ou para o celular com o app Meta Horizon. A transmissão usa o Wi-Fi local.
- Se a pessoa tirar o óculos no meio, o menu da tela permite **reiniciar** ou **voltar ao VR**.
- Para recentralizar a visão, segure o botão Meta/Oculus no controle direito. O simulador reposiciona os painéis sozinho.

---

## Estrutura dos arquivos

```
simulador-vr-defesa-civil/
├── index.html              tela inicial
├── iniciar-servidor.bat    abre o simulador no computador
├── sw.js                   cópia offline (service worker)
├── manifest.webmanifest    dados do app
├── icons/                  ícones
├── vendor/three.module.min.js   biblioteca 3D (Three.js r170, licença MIT)
└── js/
    ├── main.js                 VR, mãos/controles/mouse, loop principal
    ├── scenario-incendio.js    ⭐ roteiro e textos do cenário de incêndio
    ├── world.js                casa, móveis, portas, área externa
    ├── effects.js              fogo e fumaça
    ├── ui.js                   painéis e avisos dentro do VR
    ├── audio.js                sons (gerados no código, sem arquivos)
    └── util.js                 utilidades
```

Ao **adicionar** um arquivo novo, inclua-o na lista `ARQUIVOS` do `sw.js` e aumente a `VERSAO` para ele entrar na cópia offline.
Alterações em arquivos já existentes chegam sozinhas na próxima vez que o óculos abrir o simulador com internet.

## Ideias para próximos cenários

- Deslizamento de encosta (sinais de alerta: trincas, árvores inclinadas, água barrenta) e evacuação
- Enchente (o que fazer antes, durante e depois; não atravessar áreas alagadas)
- Vazamento de produto químico: abrigar-se no local ou evacuar
- Uso correto do extintor (classes A, B, C e técnica de uso)
