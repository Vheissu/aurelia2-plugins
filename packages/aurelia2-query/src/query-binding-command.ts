import { bindingCommand, BindingMode, itPropertyBinding, type IAttrMapper, type ICommandBuildInfo, type BindingCommandInstance, type PropertyBindingInstruction } from '@aurelia/template-compiler';
import { camelCase } from '@aurelia/kernel';
import type { ExpressionType, IExpressionParser } from '@aurelia/expression-parser';

@bindingCommand('query')
export class QueryBindingCommand implements BindingCommandInstance {
  public get ignoreAttr() { return false; }

  public build(info: ICommandBuildInfo, exprParser: IExpressionParser, attrMapper: IAttrMapper): PropertyBindingInstruction {
    const attr = info.attr;
    let target = attr.target;
    let value = attr.rawValue;
    value = value === '' ? camelCase(target) : value;

    if (info.bindable == null) {
      target = attrMapper.map(info.node, target) ?? camelCase(target);
    } else {
      target = info.bindable.name;
    }

    const expression = `${value} & query`;
    const expressionType: ExpressionType = 'IsProperty';

    return {
      type: itPropertyBinding,
      from: exprParser.parse(expression, expressionType),
      to: target,
      mode: BindingMode.toView,
    };
  }
}
