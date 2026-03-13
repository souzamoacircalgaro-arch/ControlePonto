let grafico

function gerarGrafico(){
const canvas=document.getElementById("graficoHoras")
const banco=JSON.parse(localStorage.getItem("ponto_db")||"[]")

if(banco.length===0) return

const labels=banco.map(d=>d.data)

const horas=banco.map(d=>{
if(typeof d.totalMinutos==="number") return Number((d.totalMinutos/60).toFixed(2))
if(!d.entrada || !d.almocoSai || !d.almocoVolta || !d.saida) return 0

const [eh,em]=d.entrada.split(":").map(Number)
const [sh,sm]=d.saida.split(":").map(Number)
const [lh,lm]=d.almocoSai.split(":").map(Number)
const [vh,vm]=d.almocoVolta.split(":").map(Number)

const entrada=eh*60+em
const saida=sh*60+sm
const almocoSai=lh*60+lm
const almocoVolta=vh*60+vm

const minutos=(almocoSai-entrada)+(saida-almocoVolta)
return Number((Math.max(minutos,0)/60).toFixed(2))
})

if(grafico) grafico.destroy()

grafico=new Chart(canvas,{
type:"bar",
data:{
labels,
datasets:[{
label:"Horas Trabalhadas",
data:horas,
backgroundColor:"#6366f1"
}]
},
options:{
responsive:true,
plugins:{legend:{display:false}},
scales:{
y:{beginAtZero:true}
}
}
})
}
