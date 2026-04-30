import { useState, useEffect, useRef } from "react";

const TEAL = { bg: "#1D9E75", light: "#E1F5EE", mid: "#0F6E56", dark: "#085041" };
const MEMBER_COLORS = ["#1D9E75","#185FA5","#D85A30","#7F77DD","#BA7517","#D4537E"];
const memberColor = (i) => MEMBER_COLORS[i % MEMBER_COLORS.length];
const initials = (n) => n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
const fmt = (n) => "$" + Math.abs(n).toFixed(2);
const nextId = (arr) => arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
const mkMembers = (arr) => arr.map((m,i) => ({ ...m, id: i+1 }));
const STORAGE_KEY = "splitwise_data";

const DEFAULT_GROUPS = [
  {
    id:1, name:"Utah Trip", icon:"🏔️",
    members: mkMembers([{name:"Lord Seligman",email:""},{name:"The Juzzler",email:""},{name:"Brian",email:""}]),
    expenses: [],
    settlements:[],
  },
];

function calcBalances(group) {
  const { members, expenses, settlements } = group;
  const bal = {};
  members.forEach(m => bal[m.id] = 0);
  expenses.forEach(exp => {
    const shares = getShares(exp, members);
    members.forEach(m => {
      if (m.id === exp.paidBy) bal[m.id] += exp.amount - (shares[m.id] || 0);
      else bal[m.id] -= (shares[m.id] || 0);
    });
  });
  settlements.forEach(s => { bal[s.from] += s.amount; bal[s.to] -= s.amount; });
  return bal;
}

function getShares(exp, members) {
  const n = members.length;
  if (exp.split === "equal" || !exp.customSplit || Object.keys(exp.customSplit).length === 0) {
    const share = exp.amount / n;
    return Object.fromEntries(members.map(m => [m.id, share]));
  }
  if (exp.split === "percent")
    return Object.fromEntries(members.map(m => [m.id, exp.amount * (exp.customSplit[m.id] || 0) / 100]));
  return Object.fromEntries(members.map(m => [m.id, exp.customSplit[m.id] || 0]));
}

function calcPerPayerDebts(group) {
  const { members, expenses, settlements } = group;
  const owing = {};
  members.forEach(m => { owing[m.id] = {}; members.forEach(n => { if (n.id !== m.id) owing[m.id][n.id] = 0; }); });

  expenses.forEach(exp => {
    const shares = getShares(exp, members);
    members.forEach(m => {
      if (m.id !== exp.paidBy) {
        owing[m.id][exp.paidBy] = (owing[m.id][exp.paidBy] || 0) + (shares[m.id] || 0);
      }
    });
  });

  const netOwing = {};
  members.forEach(m => {
    netOwing[m.id] = {};
    members.forEach(n => {
      if (n.id !== m.id) {
        netOwing[m.id][n.id] = (owing[m.id][n.id] || 0) - (owing[n.id][m.id] || 0);
      }
    });
  });

  settlements.forEach(s => {
    netOwing[s.from][s.to] = (netOwing[s.from][s.to] || 0) - s.amount;
    netOwing[s.to][s.from] = (netOwing[s.to][s.from] || 0) + s.amount;
  });

  const debts = [];
  const seen = new Set();
  members.forEach(from => {
    members.forEach(to => {
      if (from.id === to.id) return;
      const key = [from.id, to.id].sort().join("-");
      if (seen.has(key)) return;
      seen.add(key);
      const ab = parseFloat((netOwing[from.id][to.id] || 0).toFixed(2));
      const ba = parseFloat((netOwing[to.id][from.id] || 0).toFixed(2));
      if (ab > 0.01) debts.push({ from: from.id, to: to.id, amount: ab });
      else if (ba > 0.01) debts.push({ from: to.id, to: from.id, amount: ba });
    });
  });
  return debts;
}

function Avatar({ name, idx, size=36 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:memberColor(idx), display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:500, fontSize:size*0.35, flexShrink:0 }}>
      {initials(name)}
    </div>
  );
}

function Modal({ title, onClose, children, width=460 }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#ffffff", borderRadius:16, padding:"1.5rem", width, maxWidth:"96vw", maxHeight:"92vh", overflowY:"auto", boxSizing:"border-box", color:"#111" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:500, color:"#111" }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#666", lineHeight:1, padding:"0 2px" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:12, color:"#555", display:"block", marginBottom:5, fontWeight:500, letterSpacing:"0.03em", textTransform:"uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

const TI = (props) => <input style={{ width:"100%", boxSizing:"border-box" }} {...props} />;

function Btn({ children, onClick, variant="default", small, style={}, disabled }) {
  const base = { padding: small ? "6px 12px" : "9px 18px", borderRadius:8, cursor: disabled ? "not-allowed" : "pointer", fontSize: small ? 13 : 14, fontWeight:500, opacity: disabled ? 0.5 : 1 };
  const v = {
    default: { background:"transparent", border:"0.5px solid #ccc", color:"#111" },
    primary: { background:TEAL.bg, border:"none", color:"#fff" },
    danger:  { background:"transparent", border:"0.5px solid #ccc", color:"#E24B4A" },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...v[variant], ...style }}>{children}</button>;
}

function Tag({ children, color }) {
  const map = { teal:{ bg:TEAL.light, text:TEAL.dark }, blue:{ bg:"#E6F1FB", text:"#0C447C" }, amber:{ bg:"#FAEEDA", text:"#633806" } };
  const c = map[color] || map.teal;
  return <span style={{ fontSize:11, fontWeight:500, padding:"2px 8px", borderRadius:20, background:c.bg, color:c.text, whiteSpace:"nowrap" }}>{children}</span>;
}

function SplitEditor({ members, amount, splitMode, setSplitMode, customSplit, setCustomSplit }) {
  const n = members.length;
  const equalShare = amount > 0 ? (amount / n).toFixed(2) : "0.00";
  const total = members.reduce((s, m) => s + (parseFloat(customSplit[m.id]) || 0), 0);
  const amtLeft = (amount - total).toFixed(2);
  const pctLeft = (100 - total).toFixed(1);
  const upd = (id, val) => setCustomSplit(p => ({ ...p, [id]: val }));
  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {["equal","amount","percent"].map(m => (
          <button key={m} onClick={() => setSplitMode(m)}
            style={{ flex:1, padding:"7px 0", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer", border: splitMode===m ? `1.5px solid ${TEAL.bg}` : "0.5px solid #ccc", background: splitMode===m ? TEAL.light : "#f9f9f9", color: splitMode===m ? TEAL.mid : "#555" }}>
            {m === "equal" ? "Equal" : m === "amount" ? "By amount" : "By %"}
          </button>
        ))}
      </div>
      {splitMode === "equal" && (
        <div style={{ background:"#f5f5f5", borderRadius:10, padding:"10px 14px" }}>
          {members.map((m, i) => (
            <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom: i<members.length-1 ? "0.5px solid #ddd" : "none" }}>
              <Avatar name={m.name} idx={i} size={28} /><span style={{ flex:1, fontSize:14, color:"#111" }}>{m.name}</span>
              <span style={{ fontSize:14, color:TEAL.mid, fontWeight:500 }}>${equalShare}</span>
            </div>
          ))}
        </div>
      )}
      {(splitMode === "amount" || splitMode === "percent") && (
        <div>
          <div style={{ background:"#f5f5f5", borderRadius:10, padding:"10px 14px", marginBottom:8 }}>
            {members.map((m, i) => (
              <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom: i<members.length-1 ? "0.5px solid #ddd" : "none" }}>
                <Avatar name={m.name} idx={i} size={28} /><span style={{ flex:1, fontSize:14, color:"#111" }}>{m.name}</span>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  {splitMode === "amount" && <span style={{ fontSize:13, color:"#555" }}>$</span>}
                  <input type="number" value={customSplit[m.id] ?? ""} onChange={e => upd(m.id, e.target.value)}
                    placeholder="0" style={{ width:72, textAlign:"right", padding:"4px 8px", borderRadius:6, border:"0.5px solid #ccc", fontSize:14, background:"#fff", color:"#111" }} />
                  {splitMode === "percent" && <span style={{ fontSize:13, color:"#555" }}>%</span>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:6, alignItems:"center" }}>
            <span style={{ fontSize:12, color:"#555" }}>Remaining:</span>
            <span style={{ fontSize:13, fontWeight:500, color: (splitMode==="amount" ? Math.abs(parseFloat(amtLeft)) : Math.abs(parseFloat(pctLeft))) < 0.01 ? TEAL.bg : "#E24B4A" }}>
              {splitMode === "amount" ? `$${amtLeft}` : `${pctLeft}%`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const ICONS = ["🏠","✈️","🍕","🎉","🏖️","🚗","🎮","💼"];

export default function App() {
  const [groups, setGroups] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [view, setView] = useState("expenses");
  const [modal, setModal] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({});
  const [splitMode, setSplitMode] = useState("equal");
  const [customSplit, setCustomSplit] = useState({});
  const [saveStatus, setSaveStatus] = useState("saved");
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) throw new Error("No data");
        const data = JSON.parse(stored);
        setGroups(data.groups);
        setActiveGroup(data.activeGroup ?? data.groups[0]?.id);
      } catch {
        setGroups(DEFAULT_GROUPS);
        setActiveGroup(DEFAULT_GROUPS[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (groups === null) return;
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ groups, activeGroup }));
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 800);
  }, [groups, activeGroup]);

  if (groups === null) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", flexDirection:"column", gap:12, color:"#555" }}>
      <div style={{ width:28, height:28, border:`3px solid ${TEAL.light}`, borderTop:`3px solid ${TEAL.bg}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize:14 }}>Loading your data…</span>
    </div>
  );

  const group = groups.find(g => g.id === activeGroup) || groups[0];
  const setGroup = fn => setGroups(gs => gs.map(g => g.id === group.id ? fn(g) : g));
  const mName = id => group.members.find(m => m.id === id)?.name || "?";
  const mIdx  = id => group.members.findIndex(m => m.id === id);
  const blankSplit = () => { const s = {}; group.members.forEach(m => s[m.id] = ""); return s; };

  const openAddExpense = () => {
    setForm({ desc:"", amount:"", paidBy:group.members[0]?.id||1, date:new Date().toISOString().slice(0,10) });
    setSplitMode("equal"); setCustomSplit(blankSplit()); setModal("expense");
  };
  const openEditExpense = exp => {
    const split = {}; group.members.forEach(m => split[m.id] = exp.customSplit?.[m.id] ?? "");
    setForm({ ...exp, amount:exp.amount.toString() });
    setSplitMode(exp.split||"equal"); setCustomSplit(split); setEditTarget(exp.id); setModal("expenseEdit");
  };
  const saveExpense = () => {
    if (!form.desc || !form.amount) return;
    const exp = { desc:form.desc, amount:parseFloat(form.amount), paidBy:Number(form.paidBy), date:form.date, split:splitMode, customSplit: splitMode==="equal"?{}:Object.fromEntries(Object.entries(customSplit).map(([k,v])=>[k,parseFloat(v)||0])) };
    if (modal==="expense") setGroup(g=>({...g,expenses:[...g.expenses,{...exp,id:nextId(g.expenses)}]}));
    else setGroup(g=>({...g,expenses:g.expenses.map(e=>e.id===editTarget?{...exp,id:e.id}:e)}));
    setModal(null);
  };
  const delExpense = id => setGroup(g=>({...g,expenses:g.expenses.filter(e=>e.id!==id)}));

  const openEditMember = m => { setForm({...m}); setEditTarget(m.id); setModal("memberEdit"); };
  const openAddMember  = () => { setForm({name:"",email:""}); setModal("memberAdd"); };
  const saveMember = () => {
    if (!form.name) return;
    if (modal==="memberAdd") setGroup(g=>({...g,members:[...g.members,{...form,id:nextId(g.members)}]}));
    else setGroup(g=>({...g,members:g.members.map(m=>m.id===editTarget?{...form,id:m.id}:m)}));
    setModal(null);
  };
  const delMember = id => {
    if (group.members.length<=2) return alert("Groups need at least 2 members.");
    setGroup(g=>({...g,members:g.members.filter(m=>m.id!==id)}));
  };

  const openAddGroup  = () => { setForm({name:"",icon:"🏠"}); setModal("groupAdd"); };
  const openEditGroup = () => { setForm({name:group.name,icon:group.icon}); setModal("groupEdit"); };
  const saveGroup = () => {
    if (!form.name) return;
    if (modal==="groupAdd") {
      const ng = {id:nextId(groups),name:form.name,icon:form.icon||"🏠",members:[{id:1,name:"You",email:"you@email.com"}],expenses:[],settlements:[]};
      setGroups(gs=>[...gs,ng]); setActiveGroup(ng.id);
    } else setGroups(gs=>gs.map(g=>g.id===group.id?{...g,name:form.name,icon:form.icon}:g));
    setModal(null);
  };
  const delGroup = () => {
    if (groups.length<=1) return alert("You need at least one group.");
    const next = groups.find(g=>g.id!==group.id)?.id;
    setGroups(gs=>gs.filter(g=>g.id!==group.id)); setActiveGroup(next); setModal(null);
  };

  const openSettle = debt => { setForm({...debt,amount:debt.amount.toFixed(2)}); setModal("settle"); };
  const confirmSettle = () => {
    setGroup(g=>({...g,settlements:[...g.settlements,{id:nextId(g.settlements),...form,amount:parseFloat(form.amount),date:new Date().toISOString().slice(0,10)}]}));
    setModal(null);
  };

  const balances = calcBalances(group);
  const debts = calcPerPayerDebts(group);
  const totalSpend = group.expenses.reduce((s,e)=>s+e.amount,0);
  const splitLabel = exp => exp.split==="percent"?"%":exp.split==="amount"?"custom":"equal";
  const splitColor = exp => exp.split==="percent"?"amber":exp.split==="amount"?"blue":"teal";

  const statusDot = { saved:"#1D9E75", saving:"#F59E0B", error:"#E24B4A" }[saveStatus];
  const statusText = { saved:"Saved", saving:"Saving…", error:"Save failed" }[saveStatus];

  return (
    <div style={{ display:"flex", height:"100vh", fontFamily:"system-ui, -apple-system, sans-serif", overflow:"hidden", background:"#f5f5f5" }}>

      {/* Sidebar */}
      <div style={{ width:230, background:"#fff", borderRight:"0.5px solid #ddd", display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"1.25rem 1.125rem 1rem", borderBottom:"0.5px solid #ddd" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:TEAL.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ color:"#fff", fontSize:16, fontWeight:700 }}>$</span>
            </div>
            <span style={{ fontWeight:600, fontSize:17, color:"#111", letterSpacing:"-0.01em" }}>splitwise</span>
          </div>
        </div>
        <div style={{ padding:"0.875rem 0.625rem", flex:1, overflowY:"auto" }}>
          <div style={{ fontSize:10, color:"#999", padding:"0 0.5rem", marginBottom:6, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:500 }}>Groups</div>
          {groups.map(g => (
            <div key={g.id} onClick={()=>{setActiveGroup(g.id);setView("expenses");}}
              style={{ display:"flex", alignItems:"center", gap:9, padding:"9px 10px", borderRadius:9, cursor:"pointer", background:g.id===group.id?TEAL.light:"transparent", marginBottom:2 }}>
              <span style={{ fontSize:15 }}>{g.icon}</span>
              <span style={{ fontSize:14, fontWeight:g.id===group.id?500:400, color:g.id===group.id?TEAL.mid:"#111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.name}</span>
            </div>
          ))}
          <div onClick={openAddGroup} style={{ display:"flex", alignItems:"center", gap:9, padding:"9px 10px", borderRadius:9, cursor:"pointer", color:"#666", fontSize:14, marginTop:4 }}>
            <span style={{ fontSize:16, color:TEAL.bg, fontWeight:500 }}>+</span> New group
          </div>
        </div>
        <div style={{ padding:"0.75rem 1rem", borderTop:"0.5px solid #ddd" }}>
          <div style={{ fontSize:12, color:"#666", background:"#f9f9f9", borderRadius:8, padding:"8px 10px", marginBottom:8 }}>
            <div style={{ fontWeight:500 }}>Total spend</div>
            <div style={{ fontSize:20, fontWeight:500, color:TEAL.bg, marginTop:2 }}>{fmt(totalSpend)}</div>
          </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#999" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:statusDot, flexShrink:0 }} />
              {statusText}
            </div>
            <button onClick={()=>setModal("reset")} style={{ fontSize:11, color:"#aaa", background:"none", border:"none", cursor:"pointer", padding:"2px 4px" }}>Reset</button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"1rem 1.5rem", background:"#fff", borderBottom:"0.5px solid #ddd", display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:TEAL.light, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{group.icon}</div>
          <div style={{ flex:1 }}>
            <h1 style={{ margin:0, fontSize:19, fontWeight:500, letterSpacing:"-0.01em" }}>{group.name}</h1>
            <span style={{ fontSize:13, color:"#666" }}>{group.members.length} members · {fmt(totalSpend)} total</span>
          </div>
          <Btn onClick={openAddExpense} variant="primary">+ Add expense</Btn>
          <Btn onClick={openEditGroup}>Edit group</Btn>
        </div>

        <div style={{ display:"flex", background:"#fff", borderBottom:"0.5px solid #ddd", padding:"0 1.5rem" }}>
          {["expenses","balances","members","activity"].map(v => (
            <button key={v} onClick={()=>setView(v)}
              style={{ padding:"10px 16px", fontSize:13, fontWeight:view===v?500:400, color:view===v?TEAL.bg:"#666", background:"none", border:"none", borderBottom:view===v?`2px solid ${TEAL.bg}`:\"2px solid transparent\", cursor:"pointer", textTransform:"capitalize" }}>
              {v}
            </button>
          ))}
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"1.25rem 1.5rem" }}>

          {view==="expenses" && (
            <div>
              {group.expenses.length===0 && (
                <div style={{ textAlign:"center", marginTop:"4rem", color:"#666" }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>💸</div>
                  <div style={{ fontSize:15 }}>No expenses yet — add one to get started!</div>
                  <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:16 }}>
                    <Btn onClick={openAddExpense} variant="primary">+ Add expense</Btn>
                  </div>
                </div>
              )}
              {group.expenses.map(exp => {
                const shares = getShares(exp, group.members);
                return (
                  <div key={exp.id} style={{ background:"#fff", border:"0.5px solid #ddd", borderRadius:13, padding:"1rem 1.125rem", marginBottom:10, display:"flex", alignItems:"center", gap:12 }}>
                    <Avatar name={mName(exp.paidBy)} idx={mIdx(exp.paidBy)} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                        <span style={{ fontWeight:500, fontSize:15 }}>{exp.desc}</span>
                        <Tag color={splitColor(exp)}>{splitLabel(exp)}</Tag>
                      </div>
                      <div style={{ fontSize:12, color:"#666" }}>
                        {mName(exp.paidBy)} paid · {exp.date}
                        {exp.split!=="equal"?<span> · {group.members.map(m=>`${m.name}: ${fmt(shares[m.id])}`).join(", ")}</span>:<span> · {fmt(exp.amount/group.members.length)}/person</span>}
                      </div>
                    </div>
                    <div style={{ fontWeight:600, fontSize:18, color:TEAL.bg, flexShrink:0 }}>{fmt(exp.amount)}</div>
                    <Btn onClick={()=>openEditExpense(exp)} small>Edit</Btn>
                    <Btn onClick={()=>delExpense(exp.id)} variant="danger" small>Del</Btn>
                  </div>
                );
              })}
            </div>
          )}

          {view==="balances" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:10, marginBottom:28 }}>
                {group.members.map((m,i) => {
                  const b = balances[m.id]||0;
                  return (
                    <div key={m.id} style={{ background:"#fff", border:"0.5px solid #ddd", borderRadius:13, padding:"1rem", textAlign:"center" }}>
                      <Avatar name={m.name} idx={i} size={40} />
                      <div style={{ marginTop:8, fontWeight:500, fontSize:14 }}>{m.name}</div>
                      <div style={{ fontSize:17, fontWeight:600, marginTop:4, color:b>=0?TEAL.bg:"#E24B4A" }}>{b>=0?"+":"-"}{fmt(b)}</div>
                      <div style={{ fontSize:11, color:"#666", marginTop:2 }}>{b>=0?"gets back":"owes"}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize:11, color:"#999", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:500, marginBottom:12 }}>Suggested settlements</div>
              {debts.length===0&&<div style={{ textAlign:"center", padding:"2rem", color:"#666" }}><div style={{ fontSize:28, marginBottom:8 }}>✅</div><div>All settled up!</div></div>}
              {debts.map((d,i) => (
                <div key={i} style={{ background:"#fff", border:"0.5px solid #ddd", borderRadius:13, padding:"0.875rem 1.125rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
                  <Avatar name={mName(d.from)} idx={mIdx(d.from)} size={34} />
                  <div style={{ flex:1, fontSize:14 }}><span style={{ fontWeight:500 }}>{mName(d.from)}</span><span style={{ color:"#666" }}> → </span><span style={{ fontWeight:500 }}>{mName(d.to)}</span></div>
                  <span style={{ fontWeight:600, color:"#E24B4A", fontSize:16 }}>{fmt(d.amount)}</span>
                  <Btn onClick={()=>openSettle(d)} variant="primary" small>Settle up</Btn>
                </div>
              ))}
            </div>
          )}

          {view==="members" && (
            <div>
              {group.members.map((m,i) => (
                <div key={m.id} style={{ background:"#fff", border:"0.5px solid #ddd", borderRadius:13, padding:"1rem 1.125rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
                  <Avatar name={m.name} idx={i} size={42} />
                  <div style={{ flex:1 }}><div style={{ fontWeight:500, fontSize:15 }}>{m.name}</div><div style={{ fontSize:13, color:"#666" }}>{m.email}</div></div>
                  <div style={{ fontSize:14, color:TEAL.bg, fontWeight:500 }}>{(()=>{const b=balances[m.id]||0;return b>=0?`+${fmt(b)}`:`-${fmt(b)}`;})()}</div>
                  <Btn onClick={()=>openEditMember(m)} small>Edit</Btn>
                  <Btn onClick={()=>delMember(m.id)} variant="danger" small>Remove</Btn>
                </div>
              ))}
              <div style={{ marginTop:12 }}><Btn onClick={openAddMember} variant="primary">+ Add member</Btn></div>
            </div>
          )}

          {view==="activity" && (
            <div>
              {[...group.expenses.map(e=>({...e,type:"expense"})),...group.settlements.map(s=>({...s,type:"settle"}))]
                .sort((a,b)=>b.date?.localeCompare(a.date))
                .map((item,i) => (
                  <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"12px 0", borderBottom:"0.5px solid #ddd" }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:item.type==="expense"?TEAL.light:"#E6F1FB", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:16 }}>
                      {item.type==="expense"?"💸":"✅"}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14 }}>
                        {item.type==="expense"?<><span style={{fontWeight:500}}>{mName(item.paidBy)}</span> paid <span style={{fontWeight:500}}>{fmt(item.amount)}</span> for <span style={{fontWeight:500}}>{item.desc}</span></>:<><span style={{fontWeight:500}}>{mName(item.from)}</span> paid <span style={{fontWeight:500}}>{fmt(item.amount)}</span> to <span style={{fontWeight:500}}>{mName(item.to)}</span></>}
                      </div>
                      <div style={{ fontSize:12, color:"#666", marginTop:2 }}>{item.date}</div>
                    </div>
                    {item.type==="expense"&&<Tag color={splitColor(item)}>{splitLabel(item)}</Tag>}
                  </div>
              ))}
              {group.expenses.length===0&&group.settlements.length===0&&<p style={{ color:"#666", textAlign:"center", marginTop:"3rem" }}>No activity yet.</p>}
            </div>
          )}
        </div>
      </div>

      {modal==="reset"&&<Modal title="Reset to defaults" onClose={()=>setModal(null)}>
        <p style={{ fontSize:14, color:"#555", marginBottom:20 }}>This will delete all groups, members, and expenses and restore the default Utah Trip group. This cannot be undone.</p>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <Btn onClick={()=>setModal(null)}>Cancel</Btn>
          <Btn variant="danger" onClick={async ()=>{ localStorage.removeItem(STORAGE_KEY); setGroups(DEFAULT_GROUPS); setActiveGroup(DEFAULT_GROUPS[0].id); setModal(null); }}>Reset everything</Btn>
        </div>
      </Modal>}

      {(modal==="expense"||modal==="expenseEdit")&&(
        <Modal title={modal==="expense"?"Add expense":"Edit expense"} onClose={()=>setModal(null)} width={500}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 14px" }}>
            <div style={{ gridColumn:"1/-1" }}><Field label="Description"><TI value={form.desc||""} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} placeholder="e.g. Groceries" /></Field></div>
            <Field label="Amount ($)"><TI type="number" value={form.amount||""} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" /></Field>
            <Field label="Date"><TI type="date" value={form.date||""} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></Field>
            <div style={{ gridColumn:"1/-1" }}><Field label="Paid by"><select value={form.paidBy} onChange={e=>setForm(f=>({...f,paidBy:Number(e.target.value)}))} style={{ width:"100%", background:"#fff", color:"#111" }}>{group.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></Field></div>
          </div>
          <div style={{ borderTop:"0.5px solid #e5e5e5", paddingTop:16, marginTop:4 }}>
            <div style={{ fontSize:12, color:"#555", marginBottom:10, fontWeight:500, letterSpacing:"0.03em", textTransform:"uppercase" }}>Split method</div>
            <SplitEditor members={group.members} amount={parseFloat(form.amount)||0} splitMode={splitMode} setSplitMode={setSplitMode} customSplit={customSplit} setCustomSplit={setCustomSplit} />
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:20 }}>
            <Btn onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={saveExpense} variant="primary">Save expense</Btn>
          </div>
        </Modal>
      )}

      {(modal==="memberEdit"||modal==="memberAdd")&&(
        <Modal title={modal==="memberAdd"?"Add member":"Edit member"} onClose={()=>setModal(null)}>
          <Field label="Name"><TI value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Full name" /></Field>
          <Field label="Email"><TI value={form.email||""} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@example.com" /></Field>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}><Btn onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={saveMember} variant="primary">Save</Btn></div>
        </Modal>
      )}

      {(modal==="groupAdd"||modal==="groupEdit")&&(
        <Modal title={modal==="groupAdd"?"New group":"Edit group"} onClose={()=>setModal(null)}>
          <Field label="Group name"><TI value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Road Trip" /></Field>
          <Field label="Icon"><div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>{ICONS.map(ic=><button key={ic} onClick={()=>setForm(f=>({...f,icon:ic}))} style={{ fontSize:20, padding:"6px 8px", borderRadius:9, border:form.icon===ic?`2px solid ${TEAL.bg}`:"1.5px solid #ddd", background:form.icon===ic?TEAL.light:"#f5f5f5", cursor:"pointer" }}>{ic}</button>)}</div></Field>
          <div style={{ display:"flex", gap:8, justifyContent:"space-between", marginTop:16 }}>
            {modal==="groupEdit"&&<Btn onClick={delGroup} variant="danger">Delete group</Btn>}
            <div style={{ display:"flex", gap:8, marginLeft:"auto" }}><Btn onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={saveGroup} variant="primary">Save</Btn></div>
          </div>
        </Modal>
      )}

      {modal==="settle"&&(
        <Modal title="Settle up" onClose={()=>setModal(null)}>
          <div style={{ background:"#f5f5f5", borderRadius:10, padding:"12px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
            <Avatar name={mName(form.from)} idx={mIdx(form.from)} size={36} />
            <div style={{ fontSize:14, flex:1 }}><span style={{ fontWeight:500 }}>{mName(form.from)}</span><span style={{ color:"#666" }}> pays </span><span style={{ fontWeight:500 }}>{mName(form.to)}</span></div>
            <Avatar name={mName(form.to)} idx={mIdx(form.to)} size={36} />
          </div>
          <Field label="Amount ($)"><TI type="number" value={form.amount||""} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} /></Field>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}><Btn onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={confirmSettle} variant="primary">Confirm payment</Btn></div>
        </Modal>
      )}
    </div>
  );
}