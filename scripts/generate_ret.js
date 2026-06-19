"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var supabase_js_1 = require("@supabase/supabase-js");
var fs = __importStar(require("fs"));
// Load env vars
var dotenv = __importStar(require("dotenv"));
dotenv.config();
dotenv.config({ path: '.env.local' });
var supabaseUrl = process.env.VITE_SUPABASE_URL || '';
var supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
var supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, remessas, error, fallback, remessa, lines, retLines, _i, lines_1, line, newLine, segmento, mod, lotes, lancs, counts;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('Fetching remessas...');
                    return [4 /*yield*/, supabase
                            .from('cnab_remessas_arquivos')
                            .select('*, contas_bancarias_empresa(agencia, conta, convenio)')
                            .not('intermitentes_lote_id', 'is', null)
                            .order('created_at', { ascending: false })
                            .limit(1)];
                case 1:
                    _a = _b.sent(), remessas = _a.data, error = _a.error;
                    if (!(error || !remessas || remessas.length === 0)) return [3 /*break*/, 3];
                    console.log('No intermitentes remessa found. Finding any remessa...');
                    return [4 /*yield*/, supabase.from('cnab_remessas_arquivos').select('*, contas_bancarias_empresa(agencia, conta, convenio)').order('created_at', { ascending: false }).limit(1)];
                case 2:
                    fallback = _b.sent();
                    if (!fallback.data || fallback.data.length === 0) {
                        console.log('No remessas found at all!');
                        process.exit(1);
                    }
                    remessas.push(fallback.data[0]);
                    _b.label = 3;
                case 3:
                    remessa = remessas[0];
                    console.log('Found remessa:', remessa.id, 'lote intermitentes:', remessa.intermitentes_lote_id);
                    lines = remessa.conteudo_arquivo.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length === 240; });
                    retLines = [];
                    for (_i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                        line = lines_1[_i];
                        if (line.substring(7, 8) === '0') {
                            newLine = line.substring(0, 142) + '2' + line.substring(143);
                            retLines.push(newLine);
                        }
                        else if (line.substring(7, 8) === '1') {
                            // Header Lote
                            retLines.push(line);
                        }
                        else if (line.substring(7, 8) === '3') {
                            segmento = line.substring(13, 14);
                            if (segmento === 'A') {
                                mod = line.substring(0, 14) + '00' + line.substring(16);
                                retLines.push(mod);
                            }
                            else {
                                retLines.push(line);
                            }
                        }
                        else if (line.substring(7, 8) === '5') {
                            // Trailer Lote
                            retLines.push(line);
                        }
                        else if (line.substring(7, 8) === '9') {
                            // Trailer Arquivo
                            retLines.push(line);
                        }
                    }
                    fs.writeFileSync('teste_retorno.ret', retLines.join('\n'));
                    console.log('Created teste_retorno.ret with', retLines.length, 'lines.');
                    return [4 /*yield*/, supabase.from('intermitentes_lotes_fechamento').select('id, status, valor_total, quantidade_registros').order('created_at', { ascending: false }).limit(5)];
                case 4:
                    lotes = (_b.sent()).data;
                    console.log('INITIAL LOTES:', lotes);
                    return [4 /*yield*/, supabase.from('lancamentos_intermitentes').select('status_pipeline, count').select('status_pipeline')];
                case 5:
                    lancs = (_b.sent()).data;
                    counts = (lancs || []).reduce(function (acc, curr) {
                        acc[curr.status_pipeline] = (acc[curr.status_pipeline] || 0) + 1;
                        return acc;
                    }, {});
                    console.log('INITIAL LANCAMENTOS:', counts);
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
