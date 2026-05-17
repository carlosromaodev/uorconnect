import { describe, expect, it } from "vitest";
import {
  buildIsptecLoginForm,
  extractIsptecAcademicContext,
  extractIsptecProfile,
  resolveIsptecAcademicContextUrl,
  resolveIsptecPersonalDataUrl,
  resolveIsptecFormAction,
  resolveIsptecStudentGroupSelection,
} from "./isptec-client";

describe("isptec-client", () => {
  it("builds the ISPTEC login form with the portal field names", () => {
    const form = new URLSearchParams(
      buildIsptecLoginForm("20200227", "secret-pass"),
    );

    expect(form.get("codigo")).toBe("20200227");
    expect(form.get("senha")).toBe("secret-pass");
    expect(form.get("acao")).toBe("efetuar_login");
    expect(form.get("url_navegador")).toBe("");
  });

  it("resolves the login form action from the ISPTEC login page", () => {
    const action = resolveIsptecFormAction(
      `
        <form action="login.php?&tid=0&lid=0&pid=24&arq_ret=abc" method="post" name="form" id="form">
          <input type="text" name="codigo" id="codigo">
          <input type="password" name="senha" id="senha">
        </form>
      `,
      "https://portal.isptec.co.ao/projetos/nucleo/uteis/login.php?&tid=0",
    );

    expect(action).toBe(
      "https://portal.isptec.co.ao/projetos/nucleo/uteis/login.php?&tid=0&lid=0&pid=24&arq_ret=abc",
    );
  });

  it("extracts a student profile from the personal data block", () => {
    const profile = extractIsptecProfile(
      `
        <body>
          <main>
            <div>Topo</div>
            <div>Menu</div>
            <div>
              <h4>Dados pessoais</h4>
              <p>Número: 20200227</p>
              <p>Nome: Carlos Tiavera</p>
              <p>Curso: Engenharia Informática</p>
              <p>E-mail: carlos.tiavera@example.test</p>
              <p>Telefone: 923000000</p>
              <p>Nacionalidade: Angolana</p>
              <p>Data de nascimento: 05/01/2001</p>
            </div>
          </main>
        </body>
      `,
      "20200227",
    );

    expect(profile).toEqual(expect.objectContaining({
      name: "Carlos Tiavera",
      course: expect.stringContaining("Engenharia"),
      email: "carlos.tiavera@example.test",
      phone: "923000000",
      nationality: "Angolana",
      university: "ISPTEC",
    }));
    expect(profile.birthDate).toEqual(new Date(2001, 0, 5));
    expect(profile.academicSyncedAt).toBeInstanceOf(Date);
  });

  it("extracts a student profile from ISPTEC personal form fields", () => {
    const profile = extractIsptecProfile(
      `
        <form>
          <input id="nm_pessoa" name="nm_pessoa" value="Epifânio Pedro da Costa Cazo">
          <input id="dt_nascimento" name="dt_nascimento" value="04/09/2000">
          <input id="ds_nacionalidade" name="ds_nacionalidade" value="Angolana">
          <input id="ds_contato_03" name="ds_contato_03" value="927234389">
          <input id="ds_contato_04" name="ds_contato_04" value="20200477@isptec.co.ao">
          <input name="ds_curso_origem" value="Engenharia Informática">
          <input name="ds_turma_origem" value="EI3A">
          <input name="nr_anosemestre_origem" value="20252">
        </form>
      `,
      "20200477",
    );

    expect(profile).toEqual(expect.objectContaining({
      name: "Epifânio Cazo",
      email: "20200477@isptec.co.ao",
      phone: "927234389",
      nationality: "Angolana",
      university: "ISPTEC",
      classCode: "EI3A",
      academicYear: "2025",
      academicPeriod: "2",
    }));
    expect(profile.course).toContain("Informática");
    expect(profile.birthDate).toEqual(new Date(2000, 8, 4));
  });

  it("does not treat ISPTEC password/profile panels as student identity fields", () => {
    const profile = extractIsptecProfile(
      `
        <main>
          <section>
            <h3>Dados Complementares</h3>
            <label>E-mail:</label><br>
            Dados Complementares Senha para acesso posterior aos serviços:
            Login Senha Atual Nova Senha Confirme Nova Senha Cancelar Salvar
            <label>Nome:</label><br>
            Dados Complementares Senha Atual Nova Senha Confirme Nova Senha
            <label>Telefone:</label><br>
            Sem telefone
          </section>
          <section>
            <h3>Académico</h3>
            <p>Engenharia Informática e Comunicações</p>
            <p>ISPTEC</p>
            <p>Turma: EIN2_ESP</p>
            <p>2025 · 2</p>
          </section>
          <section>
            <h3>Pessoal</h3>
            <p>Angolana</p>
            <p>Nascimento: 04/11/2005</p>
          </section>
        </main>
      `,
      "20259999",
    );

    expect(profile.name).toBeUndefined();
    expect(profile.email).toBeUndefined();
    expect(profile.phone).toBeUndefined();
    expect(profile.course).toBe("Engenharia Informática e Comunicações");
    expect(profile.classCode).toBe("EIN2_ESP");
    expect(profile.academicYear).toBe("2025");
    expect(profile.academicPeriod).toBe("2");
    expect(profile.nationality).toBe("Angolana");
    expect(profile.birthDate).toEqual(new Date(2005, 10, 4));
  });

  it("builds the ISPTEC student-group selection request from the real group page", () => {
    const selection = resolveIsptecStudentGroupSelection(
      `
        <form action="grupo_selecionar.php?tid=0" method="post" name="form" id="form">
          <input type="hidden" id="cd_dependente_responsavel" name="cd_dependente_responsavel" value="2">
          <input type="hidden" id="ds_nome_grupo_logou" name="ds_nome_grupo_logou" value="Estudantes">
          <input type="hidden" name="acao" id="acao" value="define_grupo">
          <select id="cd_grupo" name="cd_grupo">
            <option value="2">Estudantes</option>
            <option value="10">Processo Selectivo</option>
          </select>
          <input id="btn-entrar" name="btn-entrar" type="submit" value="Entrar">
        </form>
      `,
      "https://portal.isptec.co.ao/projetos/nucleo/uteis/grupo_selecionar.php?tid=0",
    );

    expect(selection?.url).toBe(
      "https://portal.isptec.co.ao/projetos/nucleo/uteis/grupo_selecionar.php?tid=0",
    );
    expect(selection?.body.get("acao")).toBe("define_grupo");
    expect(selection?.body.get("cd_grupo")).toBe("2");
    expect(selection?.body.get("btn-entrar")).toBe("Entrar");
  });

  it("resolves the personal-data page from the ISPTEC portal menu", () => {
    const url = resolveIsptecPersonalDataUrl(
      `
        <a href="javascript:goUrl('conteudo.php?nm_menu=&cd_menu=&sid=&rp=abc&crc=123&rpd=../../projetos/unimestre/dados_pessoa/pessoas_cadastro.php?tid=0&lid=0&pid=unimestre&acao=alterar&sid=')">
          Perfil
        </a>
      `,
      "https://portal.isptec.co.ao/projetos/portal_online/index.php?&tid=0&lid=0&pid=24",
    );

    expect(url).toBe(
      "https://portal.isptec.co.ao/projetos/portal_online/conteudo.php?nm_menu=&cd_menu=&sid=&rp=abc&crc=123&rpd=../../projetos/unimestre/dados_pessoa/pessoas_cadastro.php?tid=0&lid=0&pid=unimestre&acao=alterar&sid=",
    );
  });

  it("resolves and extracts the ISPTEC academic context from the grades menu", () => {
    const menuUrl = resolveIsptecAcademicContextUrl(
      `
        <a href="javascript:goUrl('conteudo.php?nm_menu=Tm90YXMgZSBGcmVxdepuY2lhcw==&cd_menu=NTY=&sid=&rp=abc&rpd=../../projetos/diario_classes/notas_frequencias_listar.php?tid=0&lid=0&pid=diario_classes&sid=&ds_menu_uni=Notas+e++Frequ%EAncias')">
          Notas e Frequências
        </a>
      `,
      "https://portal.isptec.co.ao/projetos/portal_online/index.php?&tid=0&lid=0&pid=24",
    );

    expect(menuUrl).toContain("notas_frequencias_listar.php");

    const context = extractIsptecAcademicContext(`
      <main>
        <h1>Notas e Frequências</h1>
        <p>Histórico - Engenharia Electrotécnica(2020/1)</p>
        <p>Epifânio Pedro da Costa Cazo (20200477)</p>
        <p>2025/1 - Curso de Engenharia Electrotécnica - EELT7_T1</p>
      </main>
    `);

    expect(context).toEqual({
      course: "Engenharia Electrotécnica",
      classCode: "EELT7_T1",
      academicYear: "2025",
      academicPeriod: "1",
    });
  });
});
