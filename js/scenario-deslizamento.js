// Cenário 3 — Deslizamento de encosta (casa em área de risco)
// Fases: 1) Fatores de risco  2) Sinais de alerta (chuva forte)  3) Hora de sair (alerta, rota de fuga)
//        4) Depois do deslizamento → Resultado
//
// IMPORTANTE: os textos educativos estão concentrados neste arquivo e devem ser revisados pela
// equipe da Defesa Civil antes do uso público.
import * as THREE from 'three';
import { makeWaypoint } from './world.js';
import { createCheckSprite } from './ui.js';
import { Aborted, clamp, yawTo } from './util.js';
import { createScore, showResults } from './results.js';

export const FASES_DESLIZAMENTO = ['Fatores de risco', 'Sinais de alerta', 'Hora de sair', 'Depois do deslizamento'];

export async function runDeslizamento(g, run, opts = {}) {
  const { ui, sfx, fx, hill } = g;
  const O = hill.o;
  const { results, record } = createScore();

  const on = (obj, label, fn) => {
    const rm = g.interact.add(obj, {
      label,
      onSelect: () =>
        Promise.resolve()
          .then(fn)
          .catch((e) => {
            if (!(e instanceof Aborted)) console.error(e);
          }),
    });
    run.onCleanup(rm);
    return rm;
  };
  /** Posição local do terreno → pose do jogador olhando para (lookX, lookZ). */
  const poseAt = (x, z, lookX, lookZ) => {
    const p = hill.w(x, z);
    g.player.setPose(p.x, p.z, yawTo(lookX - x, lookZ - z), p.y);
  };
  const goTo = (x, z, lookX, lookZ) => {
    const p = hill.w(x, z);
    return g.teleport(p.x, p.z, yawTo(lookX - x, lookZ - z), p.y);
  };
  /** Círculo de teletransporte sobre o terreno. onArrive é chamado depois de chegar. */
  let moving = false; // impede dois teletransportes ao mesmo tempo (ex.: pinça dupla)
  const addWaypoint = (x, z, lookX, lookZ, label = 'Ir para cá', onArrive) => {
    const p = hill.w(x, z);
    const wp = makeWaypoint(p.x, p.z);
    wp.position.y = p.y;
    g.scene.add(wp);
    const rm = g.interact.add(wp, {
      label,
      onSelect: () => {
        if (moving) return;
        moving = true;
        return goTo(x, z, lookX, lookZ)
          .then(() => {
            moving = false;
            if (onArrive) onArrive();
          })
          .catch((e) => {
            moving = false;
            if (!(e instanceof Aborted)) console.error(e);
          });
      },
    });
    const head = new THREE.Vector3();
    const unhook = run.onFrame((dt, t) => {
      wp.userData.animate(t);
      g.player.headWorld(head);
      wp.visible = Math.hypot(head.x - p.x, head.z - p.z) > 0.8;
    });
    const remove = () => {
      rm();
      unhook();
      g.scene.remove(wp);
    };
    run.onCleanup(remove);
    return remove;
  };

  // ---------------------------------------------------------------- Clima
  const weather = { rain: null, storm: false };
  run.onCleanup(() => (g.scene.fog = null));
  const overcast = () => {
    g.world.setSky({ bg: 0xa9b4bf, hemi: 2.0, sun: 0.7 });
    g.scene.fog = new THREE.Fog(0xa9b4bf, 35, 160);
  };
  const storm = () => {
    if (weather.storm) return;
    weather.storm = true;
    g.world.setSky({ bg: 0x55606b, hemi: 1.05, sun: 0.12 });
    g.scene.fog = new THREE.Fog(0x55606b, 14, 75);
    weather.rain = fx.rain(() => g.player.headWorld());
    sfx.setRain(1);
    hill.setRainy(true);
    // relâmpagos e trovões
    let next = 5;
    let flash = 0;
    run.onFrame((dt) => {
      next -= dt;
      if (flash > 0) {
        flash -= dt;
        if (flash <= 0) g.world.setSky({ hemi: 1.05, bg: 0x55606b });
      }
      if (next <= 0) {
        next = 8 + Math.random() * 9;
        flash = 0.12;
        g.world.setSky({ hemi: 3.2, bg: 0x9aa5b0 });
        setTimeout(() => sfx.rumble(0.45, 2.5), 700);
      }
    });
  };
  // chuva some quando outro cenário começa (fx.clear no reinício)

  // ---------------------------------------------------------------- Abertura
  overcast();
  poseAt(-3, 2.4, -1.5, -6);
  await g.fade(0, 0.5);
  await ui.ask(run, {
    title: 'Deslizamento de Encosta',
    body:
      'Defesa Civil de Cubatão\n\n' +
      'Muitas famílias moram em encostas da Serra do Mar. Nesta simulação você vai aprender a reconhecer os riscos, perceber os sinais de alerta e saber a hora certa de sair.\n\n' +
      (g.isXR ? 'Aponte e faça a pinça para selecionar. Use os círculos azuis para se mover.' : 'Clique para selecionar e use os círculos azuis para se mover.'),
    buttons: [{ label: 'Começar' }],
    width: 1.25,
  });

  /** Fase de “encontrar coisas” (usada nas fases 1 e 2). */
  const searchPhase = async ({ fase, hudTitle, items, goods = [], extra = [], tone = 'warning', prefix }) => {
    let found = 0;
    const finish = run.deferred();
    const hud = () => ui.setHud([hudTitle, `Encontrados: ${found} de ${items.length}`]);
    hud();
    const markers = [];
    run.onCleanup(() => markers.forEach((m) => g.scene.remove(m)));
    for (const h of items) {
      on(h.obj, h.label, async () => {
        if (h.found) return;
        h.found = true;
        found++;
        const box = new THREE.Box3().setFromObject(h.obj);
        const mk = createCheckSprite();
        box.getCenter(mk.position);
        mk.position.y = Math.min(box.max.y + 0.15, mk.position.y + 1.2);
        mk.scale.setScalar(0.22);
        g.scene.add(mk);
        markers.push(mk);
        hud();
        sfx.good();
        await ui.ask(run, { tone, title: prefix + h.short, body: h.body, buttons: [{ label: 'Entendi' }], sound: false });
        if (found === items.length) finish.resolve();
      });
    }
    for (const gd of goods) {
      on(gd.obj, gd.label, () => {
        sfx.info();
        ui.showToast(gd.toast, 'success', 4.5);
      });
    }
    for (const ex of extra) on(ex.obj, ex.label, ex.fn);
    const wps = [
      addWaypoint(-3, 2.4, -1.5, -6), // quintal
      addWaypoint(-4.6, -2.6, -4.6, -6), // perto do barranco
      addWaypoint(-0.4, 3.5, 1.7, 6), // beira do patamar (vista da descida)
    ];
    ui.setHudButton('Concluir fase', () =>
      (async () => {
        if (finish.done) return;
        if (found < items.length) {
          const c = await ui.ask(run, {
            title: `Ainda faltam ${items.length - found}`,
            body: 'Deseja continuar procurando ou concluir esta fase?',
            buttons: [
              { label: 'Continuar procurando', value: 'cont' },
              { label: 'Concluir assim mesmo', value: 'fim' },
            ],
            sound: false,
          });
          if (c === 'fim') finish.resolve();
        } else finish.resolve();
      })().catch((e) => !(e instanceof Aborted) && console.error(e))
    );
    await finish.promise;
    ui.setHudButton(null);
    wps.forEach((rm) => rm());
    for (const h of items) {
      g.interact.remove(h.obj);
      record(fase, h.short, !!h.found);
    }
    for (const gd of goods) g.interact.remove(gd.obj);
    for (const ex of extra) g.interact.remove(ex.obj);
    markers.forEach((m) => g.scene.remove(m));
    return found;
  };

  // ---------------------------------------------------------------- FASE 1 — Fatores de risco
  const fase1 = async () => {
    await goTo(-3, 2.4, -1.5, -6);
    await ui.ask(run, {
      title: 'Fase 1 — Fatores de risco',
      body:
        'Esta casa fica numa encosta, logo abaixo de um barranco. Muitos deslizamentos começam com atitudes do dia a dia.\n\n' +
        'Encontre os 4 fatores que aumentam o risco. Também há boas práticas por aqui: veja o que acontece ao selecioná-las.',
      buttons: [{ label: 'Procurar' }],
    });
    const items = [
      {
        obj: O.trash,
        label: 'Lixo e entulho',
        short: 'Lixo e entulho na encosta',
        body: 'Lixo e entulho jogados na encosta acumulam água, pesam sobre o solo e entopem a drenagem. Com a chuva, ajudam a deslizar.\n\nDescarte o lixo nos dias de coleta e o entulho em locais autorizados.',
      },
      {
        obj: O.pipe,
        label: 'Cano saindo da casa',
        short: 'Esgoto e água lançados na encosta',
        body: 'Este cano despeja água no terreno o tempo todo e encharca o solo, mesmo sem chuva.\n\nLigue o esgoto à rede (ou a uma fossa adequada) e leve a água das calhas para a drenagem.',
      },
      {
        obj: O.bananas,
        label: 'Bananeiras',
        short: 'Bananeiras na encosta',
        body: 'A bananeira acumula muita água e tem raízes curtas, que não seguram o solo. Em encostas, prefira grama e vegetação rasteira, com orientação técnica.',
      },
      {
        obj: O.cut,
        label: 'Barranco',
        short: 'Barranco cortado alto e quase na vertical',
        body: 'Cortes altos e verticais deixam o solo sem apoio, e a casa ficou colada no pé do barranco.\n\nAntes de cortar ou aterrar um terreno, procure orientação técnica da Prefeitura e da Defesa Civil.',
      },
    ];
    const goods = [
      { obj: O.channel, label: 'Canaleta', toast: ['Boa prática!', 'A canaleta recolhe a água da chuva e a leva para longe do barranco. Mantenha-a sempre limpa.'] },
      { obj: O.grass, label: 'Grama na encosta', toast: ['Boa prática!', 'Grama e vegetação rasteira protegem o solo da erosão.'] },
      { obj: O.gauge, label: 'Pluviômetro', toast: ['Pluviômetro', 'Mede a quantidade de chuva. A Defesa Civil usa esses dados para emitir alertas.'] },
    ];
    const found = await searchPhase({ fase: 'Fatores de risco', hudTitle: 'FASE 1 — FATORES DE RISCO', items, goods, prefix: 'Risco: ' });
    await ui.ask(run, {
      tone: found === items.length ? 'success' : 'warning',
      title: `Você encontrou ${found} de ${items.length} fatores de risco`,
      items: items.map((h) => ({ text: h.short, ok: !!h.found })),
      body: 'Boas práticas: canaletas limpas, grama na encosta e orientação técnica antes de construir.',
      buttons: [{ label: 'Próxima fase' }],
    });
    ui.setHud([]);
  };

  // ---------------------------------------------------------------- FASE 2 — Sinais de alerta
  const fase2 = async () => {
    await g.fade(1, 0.6);
    storm();
    poseAt(-3, 2.4, -1.5, -6);
    await g.fade(0, 0.8);
    await ui.ask(run, {
      tone: 'warning',
      title: 'Fase 2 — Sinais de alerta',
      body:
        'Chove forte há três dias e o solo está encharcado.\n\n' +
        'Procure pela casa e pelo quintal os 6 sinais de que o terreno está se movimentando. Consulte também o pluviômetro.',
      buttons: [{ label: 'Procurar sinais' }],
    });
    // estalos vindos do barranco de tempos em tempos
    let creak = 6;
    let warned = false;
    const unhookCreak = run.onFrame((dt) => {
      creak -= dt;
      if (creak <= 0) {
        creak = 11 + Math.random() * 6;
        sfx.rumble(0.3, 1.6);
        if (!warned && !ui.modalOpen) {
          warned = true;
          ui.showToast(['Você ouviu estalos vindos do barranco...', 'Estalos e barulhos no terreno também são sinal de alerta.'], 'warning', 4.5);
        }
      }
    });
    let pluvi = false;
    const items = [
      {
        obj: O.wallCrackHit,
        label: 'Parede da casa',
        short: 'Trincas novas na parede',
        body: 'Rachaduras que surgem ou aumentam nas paredes indicam que o terreno embaixo da casa está se movendo.',
      },
      {
        obj: O.door,
        label: 'Porta da casa',
        short: 'Porta emperrando',
        body: 'Você tenta abrir a porta, mas ela raspa e emperra no batente. Portas e janelas que começam a emperrar mostram que a casa está sendo deformada pelo movimento do terreno.',
      },
      {
        obj: O.groundCrackHit,
        label: 'Chão do quintal',
        short: 'Trincas e degraus no chão',
        body: 'Rachaduras e pequenos degraus que aparecem no chão mostram que o solo está cedendo.',
      },
      {
        obj: O.wall,
        label: 'Muro do quintal',
        short: 'Muro embarrigado e inclinado',
        body: 'O muro está estufado no meio e começando a tombar: a terra está empurrando.',
      },
      {
        obj: O.tree,
        label: 'Árvore na encosta',
        short: 'Árvore inclinada',
        body: 'Árvores, postes e cercas que começam a inclinar mostram que a encosta está descendo.',
      },
      {
        obj: O.seep,
        label: 'Água saindo do barranco',
        short: 'Água barrenta minando do barranco',
        body: 'Água saindo do barranco, ainda mais se estiver barrenta, mostra que o solo está saturado e sendo carregado. É um dos sinais mais graves.',
      },
    ];
    const extra = [
      {
        obj: O.gauge,
        label: 'Pluviômetro',
        fn: async () => {
          pluvi = true;
          await ui.ask(run, {
            tone: 'warning',
            title: 'Pluviômetro',
            body: 'Ele marca 160 mm de chuva nos últimos três dias, muito acima do normal. Com o solo encharcado, o risco de deslizamento aumenta muito.\n\nA Defesa Civil acompanha esses números para emitir alertas.',
            buttons: [{ label: 'Entendi' }],
            sound: false,
          });
        },
      },
    ];
    const found = await searchPhase({ fase: 'Sinais de alerta', hudTitle: 'FASE 2 — SINAIS DE ALERTA', items, extra, tone: 'danger', prefix: 'Sinal: ' });
    unhookCreak();
    record('Sinais de alerta', 'Consultou o pluviômetro', pluvi);
    await ui.ask(run, {
      tone: found === items.length ? 'success' : 'warning',
      title: `Você encontrou ${found} de ${items.length} sinais`,
      items: items.map((h) => ({ text: h.short, ok: !!h.found })),
      body: 'Percebeu algum destes sinais? Saia de casa com a família e avise a Defesa Civil: 199.',
      buttons: [{ label: 'Próxima fase' }],
    });
    ui.setHud([]);
  };

  // ---------------------------------------------------------------- FASE 3 — Hora de sair
  const fase3 = async () => {
    const fase = 'Hora de sair';
    if (!weather.storm) {
      await g.fade(1, 0.4);
      storm();
      poseAt(-3, 2.4, -1.5, -6);
      await g.fade(0, 0.6);
    }
    sfx.setSiren(true, 0.06);
    const q1 = await ui.ask(run, {
      tone: 'danger',
      title: 'ALERTA DA DEFESA CIVIL',
      body:
        'Seu celular vibra:\n“DEFESA CIVIL: risco ALTO de deslizamento na sua região. Procure um local seguro ou o ponto de apoio mais próximo.”\n\n' +
        'A sirene da comunidade também está tocando. O que você faz?',
      columns: 1,
      buttons: [
        { label: 'Espero a chuva diminuir para sair', value: 'esperar' },
        { label: 'Vou para o quarto dos fundos, longe da rua', value: 'fundos' },
        { label: 'Saio agora e vou para o ponto de apoio', value: 'sair' },
      ],
    });
    record(fase, 'Saiu imediatamente ao receber o alerta', q1 === 'sair', 2);
    const fb1 = {
      sair: { tone: 'success', title: 'Isso mesmo!', body: 'Com alerta ou com sinais de movimento do terreno, saia imediatamente. Não espere a chuva parar: os deslizamentos acontecem durante ou logo depois das chuvas fortes.' },
      esperar: { tone: 'danger', title: 'Não espere!', body: 'Os deslizamentos acontecem durante ou logo depois das chuvas fortes, muitas vezes de madrugada. Com alerta ou sinais de movimento do terreno, saia imediatamente.' },
      fundos: { tone: 'danger', title: 'O lugar mais perigoso!', body: 'Os fundos da casa ficam colados ao barranco, justamente onde a terra chega primeiro. Saia de casa e vá para o ponto de apoio.' },
    }[q1];
    await ui.ask(run, { ...fb1, buttons: [{ label: 'Continuar' }] });

    const q2 = await ui.ask(run, {
      title: 'O que levar?',
      body: 'Você tem poucos minutos. O que leva?',
      columns: 1,
      buttons: [
        { label: 'A televisão e o que der dos móveis', value: 'moveis' },
        { label: 'O kit de emergência que já estava pronto', value: 'kit' },
        { label: 'Nada. Volto depois para buscar as coisas', value: 'voltar' },
      ],
    });
    record(fase, 'Levou só o kit de emergência', q2 === 'kit');
    await ui.ask(run, {
      tone: q2 === 'kit' ? 'success' : 'warning',
      title: q2 === 'kit' ? 'Ótimo!' : 'Tenha um kit pronto',
      body:
        'Deixe uma mochila preparada: documentos em saco plástico, remédios de uso contínuo, lanterna, água, carregador e contatos importantes. Assim você sai rápido.\n\n' +
        'Não perca tempo com móveis e não volte para buscar nada enquanto houver risco.',
      buttons: [{ label: 'Sair de casa' }],
    });

    // descida até a rua
    sfx.setSiren(true, 0.045);
    let objective = 'Desça até a rua e siga a rota de fuga';
    const hudN = () => ui.setHud(['FASE 3 — HORA DE SAIR', objective, 'Avise os vizinhos no caminho!'], 'danger');
    hudN();
    let warned = false;
    on(O.neighborDoor, 'Casa da vizinha', () => {
      if (warned) return;
      warned = true;
      sfx.good();
      ui.showToast(['Você avisou a vizinha!', 'Ela pegou as crianças e também está saindo.'], 'success', 4);
    });
    const slid = run.deferred();
    const steps = [];
    steps.push(addWaypoint(-2.9, 4.8, -2.9, 12)); // topo da escada
    steps.push(addWaypoint(-2.9, 8.3, -2.9, 14)); // meio da escada (perto da vizinha)
    steps.push(addWaypoint(-2.9, 13.3, -10, 15, 'Ir para a rua', () => slid.resolve())); // rua
    await slid.promise;
    steps.forEach((r) => r());
    g.interact.remove(O.neighborDoor);

    // o barranco desaba atrás de você
    ui.setHud(['!!!'], 'danger');
    sfx.rumble(1.4, 5);
    await run.wait(0.6);
    await g.fade(1, 0.25);
    poseAt(-2.9, 13.3, 2.5, -1.5); // vira para a casa
    await g.fade(0, 0.25);
    const dusts = [hill.wp(-2.5, 4.5, -3), hill.wp(1, 4.2, -2), hill.wp(-5, 4.4, -1)].map((p) => fx.dust(p, { count: 40, size: 1.4, height: 2.5, radius: 1.5 }));
    dusts.forEach((d) => d.setIntensity(1, 0.4));
    await hill.slide(g.tweens, 3.2);
    dusts.forEach((d) => d.setIntensity(0, 4));
    await run.wait(0.8);
    await ui.ask(run, {
      tone: 'danger',
      title: 'O barranco desabou!',
      body:
        'Poucos minutos depois de você sair, o barranco desabou sobre o quintal e os fundos da casa, onde ficam a porta e o quarto dos fundos.\n\n' +
        'Sair a tempo salva vidas. Agora siga até o ponto de apoio.',
      buttons: [{ label: 'Continuar' }],
    });
    objective = 'Siga até o ponto de apoio';
    ui.setHud(['FASE 3 — HORA DE SAIR', objective, 'Placas verdes: rota de fuga'], 'danger');

    // escolha do caminho
    let firstRoute = null;
    let chegou = false;
    while (!chegou) {
      const choice = run.deferred();
      const r1 = addWaypoint(-13, 14.4, -17, 22, 'Ir para cá', () => choice.resolve('rota'));
      const r2 = addWaypoint(9.2, 15, 11.6, 20, 'Ir para cá', () => choice.resolve('atalho'));
      const c = await choice.promise;
      r1();
      r2();
      if (firstRoute === null) firstRoute = c;
      if (c === 'rota') chegou = true;
      else {
        sfx.bad();
        await ui.ask(run, {
          tone: 'danger',
          title: 'Caminho perigoso!',
          body:
            'Durante chuva forte, a beira do córrego e o pé do morro são perigosos: a água sobe de repente, a enxurrada pode arrastar pessoas e novos deslizamentos podem acontecer.\n\n' +
            'Siga sempre a rota de fuga sinalizada.',
          buttons: [{ label: 'Voltar para a rua' }],
        });
        await goTo(-2.9, 13.3, -10, 15);
      }
    }
    record(fase, 'Avisou a vizinha', warned);
    record(fase, 'Seguiu a rota de fuga sinalizada', firstRoute === 'rota', 2);
    sfx.setSiren(false);
    await ui.ask(run, {
      tone: 'success',
      title: 'Você chegou ao ponto de apoio!',
      body: 'Aqui há abrigo, água e equipes da Defesa Civil. Informe à equipe quem saiu com você e se alguém ficou para trás.',
      buttons: [{ label: 'Continuar' }],
    });
    ui.setHud([]);
  };

  // ---------------------------------------------------------------- FASE 4 — Depois do deslizamento
  const fase4 = async () => {
    const fase = 'Depois do deslizamento';
    if (!weather.storm) {
      await g.fade(1, 0.4);
      storm();
      O.mud.visible = true;
      await hill.slide(g.tweens, 0.01);
    }
    await goTo(-13.5, 16.4, 0, -1);
    sfx.setRain(0.5);
    ui.setHud(['FASE 4 — DEPOIS DO DESLIZAMENTO']);
    const q1 = await ui.ask(run, {
      tone: 'danger',
      title: 'Pedido de socorro',
      body: 'Outra casa da rua também foi atingida e há uma pessoa presa nos escombros. O que você faz?',
      columns: 1,
      buttons: [
        { label: 'Corro para cavar os escombros com as mãos', value: 'cavar' },
        { label: 'Ligo 193, informo o local e quantas pessoas, e mantenho distância', value: 'ligar' },
      ],
    });
    record(fase, 'Chamou o resgate em vez de entrar nos escombros', q1 === 'ligar', 2);
    await ui.ask(run, {
      tone: q1 === 'ligar' ? 'success' : 'danger',
      title: q1 === 'ligar' ? 'Correto!' : 'Não entre nos escombros!',
      body:
        'Novos deslizamentos podem acontecer a qualquer momento, e quem tenta ajudar sem equipamento acaba virando outra vítima.\n\n' +
        'Ligue 193 (Bombeiros) e 199 (Defesa Civil), diga o endereço exato e quantas pessoas podem estar lá. Siga as orientações das equipes.',
      buttons: [{ label: 'Continuar' }],
    });

    const q2 = await ui.ask(run, {
      title: 'Voltar para casa',
      body: 'Quando é seguro voltar para casa?',
      columns: 1,
      buttons: [
        { label: 'Assim que a chuva parar', value: 'chuva' },
        { label: 'No dia seguinte, rapidinho, para buscar objetos', value: 'objetos' },
        { label: 'Só depois da vistoria e liberação da Defesa Civil', value: 'vistoria' },
      ],
    });
    record(fase, 'Só volta para casa após liberação da Defesa Civil', q2 === 'vistoria', 2);
    await ui.ask(run, {
      tone: q2 === 'vistoria' ? 'success' : 'warning',
      title: q2 === 'vistoria' ? 'Isso mesmo!' : 'Espere a vistoria',
      body: 'Mesmo depois que a chuva para, o solo continua encharcado e pode voltar a se mover. Só volte para casa depois que a Defesa Civil fizer a vistoria e liberar o imóvel.',
      buttons: [{ label: 'Continuar' }],
    });

    const q3 = await ui.ask(run, {
      title: 'Receber alertas',
      body: 'Como receber os alertas da Defesa Civil no celular?',
      columns: 1,
      buttons: [
        { label: 'Enviando o CEP por SMS para o número 40199', value: 'sms' },
        { label: 'Ligando para o 190 todos os dias', value: '190' },
        { label: 'Não existe esse serviço', value: 'nao' },
      ],
    });
    record(fase, 'Sabe como receber alertas (SMS 40199)', q3 === 'sms');
    await ui.ask(run, {
      tone: q3 === 'sms' ? 'success' : 'warning',
      title: q3 === 'sms' ? 'Correto!' : 'Cadastre seu CEP no 40199',
      body:
        'Envie o CEP da sua casa por SMS para 40199 (gratuito) e receba os alertas da Defesa Civil para a sua região. Em muitos lugares os alertas também chegam direto na tela do celular.\n\n' +
        'Em caso de risco, ligue 199.',
      buttons: [{ label: 'Ver resultado' }],
    });
  };

  // ---------------------------------------------------------------- Execução
  const fases = [fase1, fase2, fase3, fase4];
  const inicio = clamp(opts.startPhase || 1, 1, fases.length);
  for (const f of fases.slice(inicio - 1)) await f();
  await showResults(g, run, results, [
    'Excelente! Você sabe reconhecer o risco e a hora de sair.',
    'Bom trabalho! Revise os pontos abaixo.',
    'Atenção! Em área de risco, perceber os sinais e sair a tempo salva vidas.',
    'Vamos treinar mais? Na encosta, cada sinal de alerta importa.',
  ]);
}
