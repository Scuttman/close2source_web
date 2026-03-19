// Shared code generation & migration utilities
// Prefix rules: Project -> P + 6 letters, Organization -> O + 6 letters, Individual -> I + 6 letters

export type CodeType = 'project' | 'organization' | 'individual' | 'showcase';

function randomLetters(len:number){
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let out='';
  for(let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

export function generateCode(kind: CodeType){
  const prefix = kind === 'project' ? 'P' : kind === 'organization' ? 'O' : kind === 'showcase' ? 'S' : 'I';
  return prefix + randomLetters(6);
}

// Basic detector – if code already starts with P/O/I/S and length>=2 treat as prefixed
export function needsMigration(code?: string | null){
  if(!code) return false;
  return !/^[POIS][A-Z0-9]{6,}$/i.test(code);
}

export function inferKindFromCode(code: string): CodeType | null {
  const up = code.toUpperCase();
  if(up.startsWith('P')) return 'project';
  if(up.startsWith('O')) return 'organization';
  if(up.startsWith('I')) return 'individual';
  if(up.startsWith('S')) return 'showcase';
  return null;
}
