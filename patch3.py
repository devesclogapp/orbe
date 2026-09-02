import sys
content = open('src/App.tsx', 'r', encoding='utf-8').read()
routes_to_insert = '''
                            {/* ALIASES ROTAS CONTEXTUAIS (FASE 1A) */}
                            <Route path=\"/diaristas/aprovacoes\" element={<AuthGuard><AprovacoesRh flowType=\"DIARISTA\" lockedFlow={true} /></AuthGuard>} />
                            <Route path=\"/intermitentes/aprovacoes\" element={<AuthGuard><AprovacoesRh flowType=\"INTERMITENTE\" lockedFlow={true} /></AuthGuard>} />
                            <Route path=\"/clt/aprovacoes\" element={<AuthGuard><AprovacoesRh flowType=\"PONTO\" lockedFlow={true} /></AuthGuard>} />
                            <Route path=\"/intermitentes/inconsistencias\" element={<AuthGuard><Inconsistencias flowType=\"INTERMITENTE\" lockedFlow={true} /></AuthGuard>} />
                            <Route path=\"/clt/banco-horas\" element={<AuthGuard><PainelGeralBH /></AuthGuard>} />
                            <Route path=\"/operacoes-volume\" element={<AuthGuard><Operacoes /></AuthGuard>} />
                            <Route path=\"/operacoes-volume/nova\" element={<AuthGuard><LancamentoProducao /></AuthGuard>} />
                            <Route path=\"/operacoes-volume/aprovacoes\" element={<AuthGuard><AprovacoesRh flowType=\"OPERAÇÃO\" lockedFlow={true} /></AuthGuard>} />
                            <Route path=\"/servicos-extras/novo\" element={<AuthGuard><ServicosExtrasLancamento /></AuthGuard>} />
                            <Route path=\"/servicos-extras/lancamentos\" element={<AuthGuard><ServicosExtrasRecebidos /></AuthGuard>} />
                            <Route path=\"/custos-extras/novo\" element={<AuthGuard><CustosExtrasLancamento /></AuthGuard>} />
                            <Route path=\"/custos-extras/lancamentos\" element={<AuthGuard><CustosExtrasRecebidos /></AuthGuard>} />
                            '''
content = content.replace('{/* Protected Routes */}', '{/* Protected Routes */}'+routes_to_insert)
open('src/App.tsx', 'w', encoding='utf-8').write(content)
print('Done!')
