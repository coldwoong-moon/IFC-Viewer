import { IFCToCHDConverter } from './src/converters/IFCToCHDConverter.js';

function testParameterParsing() {
  const converter = new IFCToCHDConverter();
  
  const testParams = [
    '$,$,(#145)',
    "'name',$,(#145)",
    '#123,#456,#789',
    '(#1,#2,#3),#4,#5'
  ];
  
  console.log('Testing parameter parsing:');
  for (const params of testParams) {
    console.log(`Input: "${params}"`);
    const result = converter.parseParameters(params);
    console.log(`Result: [${result.map((p, i) => `${i}:"${p}"`).join(', ')}]`);
    console.log('');
  }
}

testParameterParsing();