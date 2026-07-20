import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const UPDATED_AT = '20/07/2026'

export default function Legal() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-ot-paper pb-20 text-ot-ink">
      <div className="flex items-center justify-between px-[22px] pt-12">
        <button type="button" onClick={() => navigate(-1)} className="flex p-1" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5 text-ot-faint" />
        </button>
        <span className="font-ot-mono text-[10px] tracking-[0.2em] text-ot-faint">TERMOS E PRIVACIDADE</span>
        <div className="w-[28px]" />
      </div>

      <div className="space-y-8 px-[22px] pt-8 font-ui text-[15px] leading-relaxed text-ot-muted [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:font-ot-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:uppercase [&_h2]:text-ot-ink [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-ot-ink [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1">

        <p className="font-ot-mono text-xs text-ot-faint">Última atualização: {UPDATED_AT}</p>

        <section id="termos">
          <h1 className="font-ot-display text-2xl font-bold uppercase text-ot-ink">Termos de Uso</h1>

          <h2>1. O que é o OnlyTraining</h2>
          <p>
            O OnlyTraining é um aplicativo para organizar e acompanhar treinos de musculação, com suporte para
            alunos e instrutores. Ele permite montar planos de treino, registrar sessões (séries, cargas, RPE,
            frequência cardíaca), acompanhar histórico e evolução, estimar gasto calórico e, para instrutores,
            acompanhar os treinos de alunos vinculados.
          </p>

          <h2>2. Conta e cadastro</h2>
          <p>
            Para usar o app você precisa criar uma conta com e-mail e senha. Você é responsável por manter suas
            credenciais em sigilo e por todas as atividades realizadas na sua conta.
          </p>

          <h2>3. Vínculo entre aluno e instrutor</h2>
          <p>
            Um instrutor pode convidar um aluno pelo e-mail cadastrado. Ao aceitar o convite, o aluno autoriza o
            instrutor a visualizar seu perfil e seus treinos enquanto o vínculo estiver ativo. O aluno pode
            solicitar o desvínculo a qualquer momento pelo próprio app.
          </p>

          <h2>4. Uso adequado</h2>
          <p>
            As estimativas de calorias, BMR e composição corporal são calculadas a partir de fórmulas conhecidas
            (ex.: MET, Keytel) e servem apenas como referência, não substituindo orientação profissional de
            educação física, nutrição ou saúde. O app não é um dispositivo médico.
          </p>

          <h2>5. Disponibilidade</h2>
          <p>
            O app é oferecido "como está". Podemos alterar, suspender ou descontinuar funcionalidades a qualquer
            momento, buscando sempre preservar os dados já registrados.
          </p>
        </section>

        <section id="privacidade">
          <h1 className="font-ot-display text-2xl font-bold uppercase text-ot-ink">Política de Privacidade</h1>

          <h2>1. Dados que coletamos</h2>
          <p>Para funcionar, o app coleta e armazena:</p>
          <ul>
            <li>Dados de conta: nome, e-mail e senha (a senha é gerenciada de forma segura pelo Supabase Auth, nunca armazenada em texto puro).</li>
            <li>Dados de perfil: foto (opcional), nome da academia, papel (aluno ou instrutor).</li>
            <li>Dados corporais e de saúde informados por você: altura, peso, idade/data de nascimento, sexo e medidas (pescoço, cintura, quadril), usados para calcular estimativas de calorias e composição corporal.</li>
            <li>Dados de treino: planos, exercícios, cargas, repetições, RPE, frequência cardíaca média e calorias estimadas de cada sessão.</li>
            <li>Dados de vínculo instrutor-aluno: e-mail usado no convite e o histórico de treinos compartilhado enquanto o vínculo está ativo.</li>
          </ul>

          <h2>2. Como usamos seus dados</h2>
          <p>
            Usamos esses dados exclusivamente para operar o app: autenticar seu acesso, exibir e calcular seus
            treinos e estimativas, e permitir que instrutores vinculados acompanhem o progresso de seus alunos.
            Não vendemos seus dados.
          </p>

          <h2>3. Compartilhamento com terceiros</h2>
          <p>Seus dados são processados pelos seguintes serviços, estritamente para o funcionamento do app:</p>
          <ul>
            <li><strong>Supabase</strong> — hospeda o banco de dados, autenticação e armazenamento de arquivos (ex.: foto de perfil).</li>
            <li><strong>Sentry</strong> — recebe relatórios técnicos de erros para nos ajudar a corrigir falhas do app.</li>
            <li><strong>NutriBase</strong> — ao finalizar um treino, enviamos automaticamente seu e-mail, a data e a estimativa de calorias da sessão, para sincronizar seu gasto calórico com essa plataforma parceira. Nenhum outro dado (cargas, medidas, frequência cardíaca) é compartilhado.</li>
          </ul>

          <h2>4. Instrutor e aluno</h2>
          <p>
            Quando você aceita um convite de instrutor, seu perfil e seus treinos ficam visíveis para esse
            instrutor enquanto o vínculo durar. Ao solicitar o desvínculo, esse acesso é encerrado.
          </p>

          <h2>5. Seus direitos</h2>
          <p>
            Você pode acessar, corrigir ou excluir seus dados a qualquer momento pelo próprio app (perfil e
            medidas corporais) ou solicitando a exclusão da conta pelo contato abaixo.
          </p>

          <h2>6. Contato</h2>
          <p>Dúvidas sobre estes termos ou sobre seus dados: entre em contato pelo suporte do app.</p>
        </section>
      </div>
    </div>
  )
}
