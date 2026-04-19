
-- Seed data for Orbe ERP

-- 1. Empresas
INSERT INTO empresas (id, nome, cnpj, unidade, cidade, estado) VALUES
('00000000-0000-0000-0000-000000000001', 'Transvolume Logística', '12.345.678/0001-90', 'Matriz SP', 'São Paulo', 'SP'),
('00000000-0000-0000-0000-000000000002', 'RodoCarga Express', '23.456.789/0001-12', 'Filial Campinas', 'Campinas', 'SP');

-- 2. Colaboradores
INSERT INTO colaboradores (id, nome, cargo, empresa_id, tipo_contrato, valor_base, matricula) VALUES
('c0000000-0000-0000-0000-000000000001', 'Imelda Hakim', 'Operadora', '00000000-0000-0000-0000-000000000001', 'Hora', 22.00, '0012'),
('c0000000-0000-0000-0000-000000000002', 'Hikmat Sofyan', 'Operador', '00000000-0000-0000-0000-000000000001', 'Operação', 35.00, '0034'),
('c0000000-0000-0000-0000-000000000003', 'Ita Septiasari', 'Conferente', '00000000-0000-0000-0000-000000000001', 'Hora', 22.00, '0051');

-- 3. Operações
INSERT INTO operacoes (data, transportadora, tipo_servico, quantidade, horario_inicio, horario_fim, produto, valor_unitario, status, responsavel_id) VALUES
(current_date, 'Transvolume', 'Volume', 320, '08:00', '11:30', 'Eletro', 4.00, 'ok', 'c0000000-0000-0000-0000-000000000001'),
(current_date, 'RodoCarga', 'Carro', 4, '09:15', '12:00', 'Móveis', 230.00, 'inconsistente', 'c0000000-0000-0000-0000-000000000002');
