// Explain the actual executed operands, including broadcast batches and bias.
// Never infer a calculation from a lesson's reference solution.
const aligned = (coords, shape) => shape.length ? coords.slice(-shape.length).map((v,i)=>shape[i]===1?0:v) : [];
export function cellExplanation(tensor, coords) {
  let product = tensor, productCoords = coords, bias;
  if(tensor.operation?.kind === 'binary' && tensor.operation.operator === '+' && tensor.operation.left.operation?.kind === 'matmul') {
    product = tensor.operation.left;
    productCoords = aligned(coords, product.shape);
    const addend = tensor.operation.right;
    bias = addend.at(aligned(coords, addend.shape));
  }
  if(product.operation?.kind !== 'matmul') return null;
  const {left, right} = product.operation, batch = productCoords.slice(0,-2);
  const count = left.shape.at(-1);
  const terms = Array.from({length:Math.min(count,12)},(_,k)=>{
    const a = left.at([...aligned(batch,left.shape.slice(0,-2)),productCoords.at(-2),k]);
    const b = right.at([...aligned(batch,right.shape.slice(0,-2)),k,productCoords.at(-1)]);
    return {a,b,value:a*b};
  });
  return {terms,count,bias,total:tensor.at(coords)};
}
