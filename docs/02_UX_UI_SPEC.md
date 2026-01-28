# UX & UI

Crie as interfaces de um aplicativo PWA de treino de academia, acessível via web e instalável no celular. O app permite que o usuário crie, gerencie e execute seus próprios treinos (A, B, C…), com exercícios, carga, repetições, check de conclusão e cronômetro de treino.
O design deve ser clean, moderno, altamente acessível e focado em usabilidade em ambiente de academia (uso rápido, uma mão, leitura fácil).
O app possui dois modos bem distintos: - Modo Treino (execução) – rápido, sem distrações - Modo Gerenciamento – criação e edição de treinos e exercícios

Diretrizes visuais gerais: - Estilo minimalista funcional, sem excesso de elementos decorativos - Paleta neutra e calma, com alto contraste (WCAG AA ou superior) - Tipografia sans-serif moderna, altamente legível - Ícones simples, reconhecíveis e consistentes - Não depender apenas de cor para indicar estado (usar ícones, texto e forma) - Espaçamentos generosos e botões grandes (pensando em toque) - Interface pensada para uso rápido e sem distrações - Botões e áreas de toque grandes (mobile-first)

Acessibilidade (obrigatório): - Botões e áreas de toque grandes - Texto legível mesmo à distância - Estados claros: ativo, concluído, desativado, foco - Não depender apenas de cor para indicar status - Animações sutis e funcionais (com possibilidade de redução de movimento)

Animações e interações - Transições suaves entre telas (150–250ms) - Micro-animações funcionais: - Check de exercício - Início e término do treino - Feedback visual claro para carregamento e estados vazios

Telas a serem desenhadas:

1. Login / Cadastro
   - Interface simples e acolhedora
   - Campos grandes e bem espaçados
   - Botões com alto contraste
   - Feedback visual claro para erro e sucesso

2. Home – Lista de Treinos
   - Lista ou cards de treinos (A, B, C…)
   - Cada treino mostra:
     . Nome
     . Foco muscular
     . Ação principal clara: Iniciar treino
     . Ação secundária discreta: Gerenciar treinos

3. Tela de Treino em Andamento
   - Layout extremamente limpo e funcional
   - Destaque visual para:
     . Nome do treino
     . Cronômetro grande e legível
   - Lista de exercícios com:
     . Nome do exercício
     . Campo de peso (stepper ou input numérico)
     . Campo de repetições
     . Checkbox grande e acessível para “feito”
   - Estados visuais claros:
     . Exercício pendente
     . Exercício concluído
   - Micro-animações suaves ao marcar um exercício como concluído

4. Finalização de Treino
   - Tela de resumo com:
     . Duração total
     . Lista de exercícios concluídos
   - Call to actions:
     . Salvar treino
     . Compartilhar resultado

5. Gerenciar Treinos
   - Interface separada do modo treino
   - Lista de treinos com opção de:
     . Criar
     . Editar
     . Excluir
   - Dentro do treino:
     . Lista de exercícios
     . Adicionar novo exercício
     . Editar nome e observações
     . Reordenar exercícios (com alternativa acessível a drag & drop)

6. Histórico de Treinos
   - Lista ou calendário de treinos realizados
   - Cada item mostra:
     . Nome do treino
     . Data
     . Duração

Resultado esperado:
Um conjunto de telas consistentes, com foco absoluto em clareza, velocidade de uso, acessibilidade e boa experiência durante o treino.
