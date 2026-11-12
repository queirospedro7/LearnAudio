# Audio

Leitor de documentos em português de Portugal, com vozes online e locais, temas claro, escuro e sépia e acompanhamento da leitura.

## Iniciar

Instala Node.js 22 ou superior e abre `start.bat`. Também podes executar:

```sh
npm install
npm start
```

Abre http://127.0.0.1:3210 e mantém o servidor em execução. Depois de atualizar o código do servidor, reinicia-o. Para atualizar a interface, usa Ctrl+F5.

## Utilização

- Importa PDF, DOCX, TXT ou Markdown, até 25 MB e 400 000 caracteres.
- Confirma o texto extraído e escolhe uma voz.
- Ajusta a velocidade e as pausas entre frases, itens, parágrafos e títulos.
- Expande o documento para ler com mais espaço. Os botões − e + ajustam o zoom entre 50% e 200%; a percentagem repõe 100%.
- Durante a leitura ou em pausa, **Recentrar** regressa à passagem atual e reativa o acompanhamento.
- Guarda o excerto atual como MP3 nas vozes online ou WAV nas vozes locais.

PDFs com texto preservam a apresentação original. A resolução é atualizada ao ampliar ou redimensionar a janela. Imagens digitalizadas dependem da resolução original e precisam de OCR externo para serem lidas. A apresentação de Word preserva a estrutura básica, mas pode diferir da paginação e dos estilos do Microsoft Word.

## Vozes e dados

As vozes Microsoft precisam de Internet e recebem o texto de cada excerto para gerar áudio. A disponibilidade depende do serviço externo. Os motores Piper e Kokoro são preparados automaticamente; a primeira instalação precisa de Internet e pode demorar. Depois de instalados, processam o texto localmente. Uma voz local só fica disponível depois de gerar áudio de teste válido.

Os modelos e os registos de instalação ficam em `data/voices/`; a cache de áudio fica em `data/audio/`. O rascunho e as preferências ficam no navegador. Estes dados e `node_modules/` estão excluídos do controlo de versões. O servidor escuta apenas em 127.0.0.1.

O destaque acompanha palavras quando o motor fornece os respetivos tempos; caso contrário, acompanha o excerto. PDFs com colunas ou disposição invulgar devem ser revistos antes de ouvir.

## Organização

| Pasta | Conteúdo |
| --- | --- |
| `src/` | Servidor, importação, estrutura do texto e motores de voz |
| `public/js/` | Interface, reprodução e visualização dos documentos |
| `public/css/` | Estilos base, temas e apresentação |
| `public/` | Página de entrada e favicon |
| `scripts/` | Integração Python necessária para Kokoro |
| `test/` | Testes automatizados |
| `data/` | Dados locais gerados durante a utilização |

## Verificação

```sh
npm test
```

Os testes verificam a estrutura do texto, pausas, sincronização, contraste e dimensionamento do PDF. A qualidade da voz e a apresentação final devem também ser verificadas na aplicação.

## Fontes dos motores locais

- [Piper](https://github.com/rhasspy/piper): motor MIT; [modelo Tugão](https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_PT/tug%C3%A3o/medium/MODEL_CARD).
- [Kokoro PT-PT](https://huggingface.co/logus2k/kokoro_tts_eu_pt): modelo Apache-2.0; integração `tts_eu_pt`.


## Publicar na Vercel

1. Envia este projeto para um repositório Git e importa-o na Vercel.
2. Usa a raiz do projeto e mantém a configuração de vercel.json. O build executa npm run build; a interface fica em public e a API em api/index.js.
3. Usa Node.js 22. Não são necessárias variáveis de ambiente adicionais.
4. Publica primeiro uma Preview e confirma importação, vozes e reprodução no endereço publicado.

A versão alojada aceita documentos até 4 MB para respeitar o limite de pedidos da plataforma. A versão local mantém os 25 MB. Piper e Kokoro só estão disponíveis no computador; a versão online utiliza as vozes Microsoft. A geração de áudio depende desse serviço externo e deve ser confirmada após publicar.

O build inclui os ficheiros do leitor PDF. Modelos, cache de áudio, documentos temporários e dependências instaladas não devem ser enviados manualmente. Na Vercel, a cache fica na pasta temporária de cada instância. O áudio e os tempos de palavras são devolvidos no mesmo pedido, evitando depender de ficheiros de outra instância.

## Telemóvel e segundo plano

A interface adapta-se a ecrãs pequenos, orientação horizontal e zonas reservadas do dispositivo. O acompanhamento usa deslocação suave e respeita a preferência de reduzir movimento. Desativar a centragem mantém a deslocação manual no modo expandido.

A integração Media Session permite pausar, continuar e mudar de excerto através dos controlos multimédia, quando suportados. O áudio não é pausado ao mudar de separador. A reprodução com ecrã bloqueado depende do navegador e do sistema operativo: a suspensão da página pode atrasar as pausas, os pedidos de áudio e a transição entre excertos. Não é garantida reprodução contínua em segundo plano em todos os dispositivos. Não existe modo offline na versão alojada.

Antes da publicação final, testa Safari/iPhone, Chrome/Android e os navegadores de computador, incluindo ecrã bloqueado, chamadas, auscultadores, zoom e importação de um documento real.
