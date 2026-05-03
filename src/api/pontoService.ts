import { fetchPonto as realFetchPonto, listPontoByEmpresa as realList } from './ponto';
import { fetchPonto as mockFetch, listPontoByEmpresa as mockList } from './__mocks__/ponto';

const useMock = !process.env.REACT_APP_ENABLE_PONTO_API;

export const fetchPonto = useMock ? mockFetch : realFetchPonto;
export const listPontoByEmpresa = useMock ? mockList : realList;
