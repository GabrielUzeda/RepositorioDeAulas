-- Seed Demo Data

-- 1. Create Demo Turma
INSERT INTO turmas (slug, nome, cor, icone, senha, descricao)
VALUES (
    'demo-class', 
    'Turma de Demonstração', 
    'bg-indigo-600', 
    'school', 
    'asdf1234', 
    'Clique aqui para entrar na turma. A senha de acesso é "asdf1234".\n\n\n\nEsta turma contém os seguintes exemplos:\n- Aulas (conteúdo teórico)\n- Provas (avaliação)\n- Minigames (simulação tática)\n- Roleta (sorteio de perguntas)\n- Reforço (exercícios extras)'
) ON CONFLICT (slug) DO NOTHING;

-- Get the ID of the inserted turma (assuming it's the latest one or selecting by slug)
DO $$
DECLARE
    v_turma_id INTEGER;
BEGIN
    SELECT id INTO v_turma_id FROM turmas WHERE slug = 'demo-class';

    -- 2. Create Intro Aula
    INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem, conteudo_md)
    VALUES (
        v_turma_id,
        'Boas-vindas ao Sistema',
        '/apresentacoes/boas-vindas.html',
        '00',
        'Comece por aqui: Entenda como navegar e usar o sistema.',
        1,
        '# Bem-vindo ao Repositório de Aulas!\n\nEste sistema foi desenvolvido para facilitar o acesso a materiais didáticos e atividades interativas.\n\n### Como usar:\n1. Navegue pelas guias "Aulas" e "Atividades".\n2. Clique nos cards para abrir o conteúdo.\n3. Acompanhe seu progresso e divirta-se aprendendo!'
    );

    -- 3. Create Minigame Activity
    INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone, tipo, ordem, json_data)
    VALUES (
        v_turma_id,
        'demo-minigame',
        'Simulação Tática: Defesa Cibernética',
        'Teste seus reflexos e conhecimentos neste minigame de nave.',
        '#',
        '01',
        'minigame',
        1,
        '{"questions":[{"content":"Qual protocolo é seguro para transferência de arquivos?","options":[{"text":"FTP","correct":false},{"text":"SFTP","correct":true},{"text":"HTTP","correct":false}]},{"content":"O que significa a sigla VPN?","options":[{"text":"Virtual Private Network","correct":true},{"text":"Very Public Network","correct":false},{"text":"Visual Point Node","correct":false}]}]}'
    );

    -- 4. Create Roleta Activity
    INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone, tipo, ordem, json_data)
    VALUES (
        v_turma_id,
        'demo-roleta',
        'Roleta do Conhecimento',
        'Gire a roleta e responda à pergunta sorteada!',
        '#',
        '02',
        'roleta',
        2,
        '{"questions":[{"title":"Conceitos Básicos","content":"O que é um algoritmo?","options":[{"text":"Sequência de passos lógicos","correct":true,"feedback":"Correto! Um algoritmo é uma receita para resolver problemas passo a passo."},{"text":"Uma peça de hardware","correct":false,"feedback":"Incorreto. O hardware é a parte física (como teclado e monitor). Um algoritmo é lógico/software."}]},{"title":"Hardware","content":"Cite 3 componentes de entrada.","options":[{"text":"Teclado, Mouse, Microfone","correct":true,"feedback":"Excelente! Esses são exemplos clássicos de hardware de entrada de dados."},{"text":"Monitor, Caixa de Som","correct":false,"feedback":"Incorreto. Monitor e caixa de som são exemplos de dispositivos de SAÍDA de dados."}]},{"title":"Software","content":"Qual a diferença entre SO e Aplicativo?","options":[{"text":"O SO gerencia tudo, o aplicativo faz tarefas específicas.","correct":true,"feedback":"Isso mesmo! O Sistema Operacional controla o computador, e o aplicativo atende ao usuário."},{"text":"Ambos são a mesma coisa físicamente","correct":false,"feedback":"Incorreto. Ambos são softwares e servem a propósitos distindos (gerenciamento vs tarefas específicas)."}]},{"title":"Redes","content":"Qual a utilidade do IP?","options":[{"text":"Identificar uma máquina na rede","correct":true,"feedback":"Exatamente! O IP é como o endereço residencial de um computador na rede."},{"text":"Proteger contra vírus","correct":false,"feedback":"Incorreto. A proteção contra vírus é feita por antivírus e firewalls, não pelo protocolo IP."}]},{"title":"Segurança","content":"O que é Phishing?","options":[{"text":"Um tipo de ataque de engenharia social","correct":true,"feedback":"Correto! É quando tentam enganar você para que forneça dados sensíveis."},{"text":"Um programa de edição de imagem","correct":false,"feedback":"Incorreto. Programas de edição de imagem nada têm a ver com Phishing."}]},{"title":"Geral","content":"O que significa WWW?","options":[{"text":"World Wide Web","correct":true,"feedback":"Exatamente! Essa é a grande rede mundial de computadores."},{"text":"Wild World Web","correct":false,"feedback":"Incorreto. Apesar do trocadilho divertido, o correto é World Wide Web."}]}]}'
    );

    -- 5. Create Prova Activity
    INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone, tipo, ordem, senha, allow_password, json_data)
    VALUES (
        v_turma_id,
        'demo-prova',
        'Avaliação Diagnóstica',
        'Teste seus conhecimentos iniciais. Senha de acesso: avaliação',
        '#',
        '03',
        'prova',
        3,
        'avaliação',
        true,
        '{"meta":{"title":"Avaliação Diagnóstica"},"questions":[{"content":"Qual a função da Memória RAM no processamento de dados do computador?"},{"content":"Descreva como funciona o fluxo de informação entre o processador, a memória e o disco de armazenamento."},{"content":"Disserte sobre a importância dos sistemas operacionais e como eles ajudam o usuário comum."}]}'
    );
     
     -- 6. Create Reforço Activity
    INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone, tipo, ordem, json_data)
    VALUES (
        v_turma_id,
        'demo-reforco',
        'Atividade de Reforço',
        'Exercícios extras para praticar.',
        '#',
        '04',
        'reforco',
        4,
        '{"meta":{"type":"reforco","title":"Prática de Fixação"},"questions":[{"content":"Hardware é a parte física, Software é a parte lógica.","options":[{"text":"Verdadeiro","correct":true,"feedback":"Isso mesmo! Hardware é tocável, software não."},{"text":"Falso","correct":false,"feedback":"Incorreto. A definição de HW/SW segue essa base."}]},{"content":"A Memória RAM é não-volátil (não perde dados se faltar energia).","options":[{"text":"Falso","correct":true,"feedback":"Correto! A RAM é volátil."},{"text":"Verdadeiro","correct":false,"feedback":"Incorreto. A memória não-volátil é a ROM ou o Disco."}]},{"content":"Um navegador web atua como um Hardware.","options":[{"text":"Falso","correct":true,"feedback":"Excelente! O navegador é um software."},{"text":"Verdadeiro","correct":false,"feedback":"Incorreto. É um aplicativo, portanto, software."}]},{"content":"Para salvar um documento de texto permanentemente usamos:","options":[{"text":"O Disco (SSD/HD)","correct":true,"feedback":"Perfeito! O armazenamento em massa é persistente."},{"text":"A CPU","correct":false,"feedback":"Incorreto. CPU processa, não armazena permanentemente."}]}]}'
    );
     
    -- 7. Create Normal Activity
    INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone, tipo, ordem, json_data)
    VALUES (
        v_turma_id,
        'demo-normal',
        'Atividade Normal',
        'Responda as questões discursivas e envie para avaliação.',
        '#',
        '05',
        'normal',
        5,
        '{"meta":{"title":"Questionário Teórico","description":"Responda as questões discrusivas utilizando o editor."},"questions":[{"content":"Explique com suas palavras as três principais etapas de qualquer algoritmo na computação."},{"content":"Qual é a principal função da Placa-Mãe em relação aos demais Hardwares?"}]}'
    );

END $$;
