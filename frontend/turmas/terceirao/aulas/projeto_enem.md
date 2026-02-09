---
marp: true
theme: uncover
paginate: true
style: |
  @import url('https://fonts.googleapis.com/css2?family=Ninja+Naruto&display=swap');
  
  section {
    background-image: url('https://wallpapers.com/images/high/hidden-leaf-village-6fhejojfwq5g85o4.webp');
    background-size: cover;
    background-position: center;
    font-family: 'Ninja Naruto', sans-serif;
    color: #3D2314;
    padding: 20px;
  }

  section.lead h1 {
    font-size: 50px;
    text-align: center;
    color: #FF9900;
    text-shadow: 3px 3px 6px #000000;
    margin-bottom: 20px;
  }
  
  section.lead p {
    text-align: center;
    font-size: 24px;
    color: #FFFFFF;
    background-color: rgba(0, 0, 0, 0.7);
    padding: 10px;
    border-radius: 8px;
  }

  h1, h2 {
    color: #D9531E;
    text-shadow: 2px 2px 4px #000;
    border-bottom: 2px solid #4A3F35;
    padding-bottom: 5px;
    font-size: 36px;
    margin: 15px 0;
  }

  h3 {
    color: #2E5C8A;
    text-shadow: 1px 1px 2px #000;
    font-size: 24px;
    margin: 10px 0;
  }

  p, li {
    font-size: 18px;
    line-height: 1.4;
    background-color: rgba(255, 248, 220, 0.9);
    padding: 10px;
    border-radius: 6px;
    border: 1px solid #C8B575;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    margin: 8px 0;
  }

  ul {
    padding-left: 30px;
    margin: 0;
    list-style: none; /* remove o marcador padrão */
  }

  ul li::before {
    content: "🍥";   /* emoji como marcador */
    margin-right: 8px; /* espaço entre emoji e texto */
    display: inline-block;
  }

  strong {
    color: #AF2419;
  }
  
  pre {
    background-color: rgba(255, 248, 220, 0.9);
    border-radius: 6px;
    border: 1px solid #C8B575;
    color: #3D2314;
    padding: 15px;
    text-align: center;
    font-family: monospace;
    font-size: 16px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    margin: 10px 0;
  }

  section {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .character-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 15px;
    background-color: rgba(255, 248, 220, 0.9);
    padding: 20px;
    border-radius: 8px;
    border: 2px solid #C8B575;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  }

  .character-item {
    text-align: center;
    font-size: 14px;
    color: #3D2314;
    padding: 8px;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 6px;
    border: 1px solid #D9531E;
  }

  .character-item img {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 2px solid #FF9900;
    margin-bottom: 5px;
    object-fit: cover;
  }

  .team-skills {
    background-color: rgba(255, 248, 220, 0.85);
    padding: 12px;
    border-radius: 6px;
    border: 2px solid #4A3F35;
    margin: 8px 0;
  }

  .skill-badge {
    display: inline-block;
    background-color: #FF9900;
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 14px;
    margin: 2px;
    text-shadow: 1px 1px 2px #000;
  }

  .character-item {
    display: flex;
    align-items: center; 
    justify-content: center; 
    gap: 10px;
    font-size: 14px;
    color: #3D2314;
    padding: 8px;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 6px;
    border: 1px solid #D9531E;
  }

  .character-item img {
    margin-bottom: 0; 
   }
---

# Missão: ENEM com IA - Gerador de Perguntas

Sistema ninja para criar questões inteligentes do ENEM usando as provas antigas como base de treinamento

---

## O Que Vamos Construir

Um sistema completo onde você escolhe um tema e a IA gera uma questão personalizada. Depois de aprovada, ela vai para o banco de dados com sistema de curtidas para ranquear as melhores questões.

---

## Como Funciona Nossa Missão

- **Entrada:** Provas antigas do ENEM alimentam a IA
- **Processo:** Usuário escolhe tema → IA gera questão → Aprovação
- **Resultado:** Questão armazenada com sistema de ranking por curtidas
- **Objetivo:** Biblioteca inteligente de questões personalizadas

---

## Os 4 Esquadrões da Aldeia

Cada equipe tem uma habilidade especial e característica única para o sucesso da missão:

<pre>
🐍 Python (Conexão) → 📋 JSON (Comunicação) 
<b>↓</b>                  <b>↓</b>
🧠 IA (Criação) → 🗃️ SQL (Armazenamento)
</pre>

---

## Seleção dos Líderes Chunin

<div class="character-grid">

  <div class="character-item">
    <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3mYW3HcEK1-zC-OBxfDZ1aQb7V5IIgHsjue20MskxHWeFJ-z50gDXpQYSNctx3dOiIHqvXupPihtAGOlY8zdQN0NpPeNouLblaiWn31Ni8A" alt="Asuma">
    <strong>Asuma Sarutobi</strong>
  </div>

  <div class="character-item">
    <img src="https://pm1.aminoapps.com/6417/155e064710eb64a9edbead51dcbab44338d1fde3_00.jpg" alt="Hayate">
    <strong>Hayate Gekkō</strong>
  </div>

  <div class="character-item">
    <img src="https://static.wikia.nocookie.net/naruto/images/f/fe/Genma.png/revision/latest?cb=20130213205429&path-prefix=pt-br" alt="Genma">
    <strong>Genma Shiranui</strong>
  </div>

  <div class="character-item">
    <img src="https://static.wikia.nocookie.net/naruto/images/4/4b/Ibiki_Part_I.png/revision/latest?cb=20220218113218" alt="Ibiki">
    <strong>Ibiki Morino</strong>
  </div>

  <div class="character-item">
    <img src="https://static.wikia.nocookie.net/naruto/images/3/38/Anko_Mitarashi.png/revision/latest?cb=20230930124933&path-prefix=pt-br" alt="Anko">
    <strong>Anko Mitarashi</strong>
  </div>

  <div class="character-item">
    <img src="https://static.wikia.nocookie.net/naruto/images/b/b8/Iruka_Umino.png/revision/latest?cb=20130527233100&path-prefix=pt-br" alt="Iruka">
    <strong>Iruka Umino</strong>
  </div>

  <div class="character-item">
    <img src="https://static.wikia.nocookie.net/naruto/images/5/5d/Izumo_Kamizuki.png/revision/latest?cb=20130525010448&path-prefix=pt-br" alt="Izumo">
    <strong>Izumo Kamizuki</strong>
  </div>

  <div class="character-item">
    <img src="https://static.wikia.nocookie.net/naruto/images/b/ba/Kotetsu_Hagane.PNG/revision/latest?cb=20140803231221&path-prefix=pt-br" alt="Kotetsu">
    <strong>Kotetsu Hagane</strong>
  </div>

  <div class="character-item">
    <img src="https://pm1.aminoapps.com/6310/02d6dea3bcf24fddd54e510fbc8d494adb992d55_hq.jpg" alt="Kurenai">
    <strong>Kurenai Yuhi</strong>
  </div> 

</div>

---

## Formação dos Esquadrões

Agora cada líder vai recrutar seus aliados baseado nas competências necessárias para sua missão específica.

---

## Equipe Python 🐍

### Os Conectores da Aldeia

**Missão:** Ser o cérebro central que conecta todas as outras equipes

<div class="team-skills">
<strong>Habilidades Necessárias:</strong><br>
<span class="skill-badge"><b>Comunicação</b></span>
<span class="skill-badge"><b>Organização</b></span>
<span class="skill-badge"><b>Resolução de Problemas</b></span>
</div>

- Criar o backend que une IA, banco de dados e interface
- Desenvolver APIs para comunicação entre sistemas
- Validar dados e garantir que tudo funcione junto

---

## Equipe IA 🧠

### Os Estrategistas

**Missão:** Dominar a arte da criação inteligente de questões

<div class="team-skills">
<strong>Habilidades Necessárias:</strong><br>
<span class="skill-badge"><b>Criatividade</b></span>
<span class="skill-badge"><b>Análise</b></span>
<span class="skill-badge"><b>Paciência</b></span>
<span class="skill-badge"><b>Experimentação</b></span>
</div>

- Treinar a IA com as provas antigas do ENEM
- Criar e testar comandos para gerar questões de qualidade
- Analisar e melhorar continuamente os resultados

---

## Equipe JSON 📋

### Os Mensageiros Universais

**Missão:** Ser a linguagem comum entre todas as equipes

<div class="team-skills">
<strong>Habilidades Necessárias:</strong><br>
<span class="skill-badge"><b>Detalhismo</b></span>
<span class="skill-badge"><b>Organização</b></span>
<span class="skill-badge"><b>Comunicação</b></span>
<span class="skill-badge"><b>Padronização</b></span>
</div>

- Criar a estrutura de dados que todos vão usar
- Garantir que informações fluam sem erros
- Ser a ponte entre frontend, backend e IA

---

## Equipe SQL 🗃️

### Os Guardiões do Conhecimento

**Missão:** Proteger e organizar todas as questões criadas

<div class="team-skills">
<strong>Habilidades Necessárias:</strong><br>
<span class="skill-badge"><b>Organização</b></span>
<span class="skill-badge"><b>Segurança</b></span>
<span class="skill-badge"><b>Eficiência</b></span>
<span class="skill-badge"><b>Confiabilidade</b></span>
</div>

- Criar o banco de dados para armazenar questões
- Desenvolver sistema de curtidas e ranking
- Garantir que nada se perca e tudo seja rápido

---

## Que Comece a Missão!

Líderes escolhidos ✅  
Equipes formadas ✅  
Habilidades mapeadas ✅

**Próximo passo:** Cada esquadrão vai planejar sua estratégia específica para conquistar seus objetivos!
