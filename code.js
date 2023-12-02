$(function () {
	//初始化
	(function init() {

		function showInfo(info) {
			$('.info').show().html(info);
		}

		function hideInfo() {
			$('.info').hide();
		}
		const jsonEditorCachekey = 'jsonEditor';

		let resultDartCode = '';

		/// * initial jsonTestCase
		let jsonTestCase = {
			"normalField": "Hello World",
			"is_support_camel_case": true,
			"return": "changed to xReturn | DART Protected Key",
			"1NamedStartWithDigit": 123,
			"@NamedStartWithSymbol": true,
			".jpg":"wow~",
			"_underscore": "~special case~",
			"demension_array": [[{ "depth": "hi there" }]]
		};

		

		// create the editor
		const container = document.getElementById("origJsonContainer")
		const options = {
			"mode": "code",
			onChangeText: (str) => {
				$.cookie(jsonEditorCachekey, str);
				generate();
			},
		}
		let editor;
		try {
			editor = new JSONEditor(container, options)
		} catch {
			showInfo('Load JSONEditor faild, please try reload');
		}

		function tryParseJSON(jsonString) {
			try {
				var o = JSON.parse(jsonString);
				if (o && typeof o === "object") {
					return o;
				}
			} catch (e) { }
			return false;
		}

		function generate() {
			hideInfo();
			let jsonObj;
			try {
				jsonObj = editor.get();
			} catch (error) {
				$('#dartCode').html(error.toString());
				return;
			}

			let forceStringCheckBox = $('#forceStringCheckBox').prop('checked');
			let shouldEnhanceFaultTolerance = $('#faultToleranceCheckBox').prop('checked');

			//snake to camel
			const snakeToCamel = (str) => str.replace(
				/([-_][a-zA-Z])/g,
				(group) => group.toUpperCase()
					.replace('-', '')
					.replace('_', '')
			);

			//Remove duplicate elements
			let removeSurplusElement = (obj) => {
				if (Array.isArray(obj)) {
					obj.length = 1;
					removeSurplusElement(obj[0]);
				} else if (typeof obj === 'object') {
					for (let key in obj) {
						if (obj.hasOwnProperty(key)) {
							removeSurplusElement(obj[key])
						}
					}
				}
			};
			
			//Uppercase conversion
			let uppercaseFirst = (string) => {
				return string.charAt(0).toUpperCase() + string.slice(1);
			};
			
			//DART keyword protection
			let dartKeywordDefence = key => {
				if (typeof key === 'string') {
					//https://dart.dev/guides/language/language-tour
					let reservedKeywords = ["num", "double", "int", "String", "bool", "List", "abstract", "dynamic", "implements", "show", "as", "else", "import", "static", "assert", "enum", "in", "super", "async", "export", "interface", "switch", "await", "extends", "is", "sync", "break", "external", "library", "this", "case", "factory", "mixin", "throw", "catch", "false", "new", "true", "class", "final", "null", "try", "const", "finally", "on", "typedef", "continue", "for", "operator", "var", "covariant", "Function", "part", "void", "default", "get", "rethrow", "while", "deferred", "hide", "return", "with", "do", "if", "set", "yield"];
					let isStartWithNum = key.match(/^\d/);
					if (reservedKeywords.includes(key) || isStartWithNum) {
						return `x${uppercaseFirst(key)}`;
					}

					let isStartWithSymbol = key.match(/[ `!@#$%^&*()+\-=\[\]{};':"\\|,.<>\/?~]/);
					if (reservedKeywords.includes(key) || isStartWithSymbol) {
						return `x${uppercaseFirst(key.substring(1).replaceAll(/[ `!@#$%^&*()+\-=\[\]{};':"\\|,.<>\/?~]/g,''))}`;
					}

					const isUpperCase = (string) => /^[A-Z]*$/.test(string)
					if (reservedKeywords.includes(key) || isUpperCase(key)) {
						return `x${uppercaseFirst(key)}`;
					}

					if (key.startsWith('_')) {
						return `x${uppercaseFirst(key)}`;
					}
				}
				return key;
			};

			//Generic string generator
			let genericStringGenerator = (innerClass, count) => {
				let genericStrings = [innerClass];
				while (count) {
					genericStrings.unshift('List<');
					genericStrings.push('>');
					count--;
				}
				let genericString = genericStrings.join('');
				return genericString;
			}

			//!Get the innermost object, type and layer number
			let getInnerObjInfo = (arr, className) => {
				let count = 0;
				let getInnerObj = (arr) => {
					if (Array.isArray(arr)) {
						let first = arr[0];
						count++;
						return getInnerObj(first);
					} else {
						return arr;
					}
				}

				let inner = getInnerObj(arr);
				let innerClass = className;
				if (typeof inner === 'object') { } else if (typeof inner === 'boolean') {
					//we don't handle boolean
					innerClass = 'bool';
				} else {
					if (typeof inner === 'string') {
						innerClass = 'String';
					}
					if (typeof inner === 'number') {
						if (Number.isInteger(inner)) {
							innerClass = 'num';
						} else {
							innerClass = 'num';
						}
					}
					if (forceStringCheckBox) {
						innerClass = 'String';
					}
				}
				return {
					inner,
					innerClass,
					count
				};
			};
			//!Get the array cycle sentence
			let getIterateLines = (arr, className, key, legalKey, jsonKey, shouldNullSafe) => {

				if (legalKey == 'data') {
					legalKey = 'this.data';
				}

				function makeBlank(count) {
					let str = '';
					for (let index = 0; index < count + 1; index++) {
						str += '  ';
					}
					return str;
				};

				let {
					inner,
					innerClass,
					count
				} = getInnerObjInfo(arr, className);
				if (inner === undefined || inner === null) {
					showInfo(` 💬 WARNING : the property named &nbsp <b>'${key}'</b> &nbsp is an EMPTY array ! parse process is failed !`);
					let jk = jsonKey.replaceAll('\'','');
					return {
						fromJsonLinesJoined: `${makeBlank(1)}/// \!WARNING: object \`${jk}\` is an EMPTY arraylist\n${makeBlank(1)}if (json['${jk}'] != null) {\n${makeBlank(2)}${jk} = <dynamic>[];\n${makeBlank(2)}json['${jk}'].forEach((v) {\n${makeBlank(3)}${jk}!.add(v);\n${makeBlank(2)}});\n${makeBlank(1)}}\n`,
						toJsonLinesJoined: `${makeBlank(1)}/// \!WARNING: object \`${jk}\` is an EMPTY arraylist\n${makeBlank(1)}if (${jk} != null) {\n${makeBlank(2)}data['${jk}'] = ${jk}!.map((v) => v.toJson()).toList();\n${makeBlank(1)}}\n`,
					};
				}
				let total = count;
				let fromJsonLines = [];
				let toJsonLines = [];

				count--;

				if (typeof inner === 'object') {
					fromJsonLines.push(`${makeBlank(2)}v.forEach((v) {\n${makeBlank(3)}arr${count}.add(${className}.fromJson(v));\n${makeBlank(2)}});`);
					toJsonLines.push(`${makeBlank(2)}v${shouldNullSafe ? '?' : ''}.forEach((v) {\n${makeBlank(3)}arr${count}.add(v${shouldNullSafe ? '?' : ''}.toJson());\n${makeBlank(2)}});`);
				} else {
					let toType = 'v';
					if (typeof inner === 'boolean') {
						//we don't handle boolean
					} else {
						if (forceStringCheckBox) {
							inner = inner.toString();
						}
						if (typeof inner === 'string') {
							toType = 'v.toString()';
						}
						if (typeof inner === 'number') {
							if (Number.isInteger(inner)) {
								toType = shouldEnhanceFaultTolerance ? 'int.tryParse(v.toString() ?? \'\')' : 'v.toInt()';
							} else {
								toType = shouldEnhanceFaultTolerance ? 'double.tryParse(v.toString() ?? \'\')' : 'v.toDouble()';
							}
						}
					}
					if ((typeof inner === 'string') || (typeof inner === 'number') || (typeof inner === 'boolean')) {
						fromJsonLines.push(`${makeBlank(count * 3)}v.forEach((v) {\n${makeBlank(count * 4)}arr${count}.add(${toType});\n${makeBlank(count * 3)}});`);
						toJsonLines.push(`${makeBlank(count * 3)}v${shouldNullSafe ? '!' : ''}.forEach((v) {\n${makeBlank(count * 4)}arr${count}.add(v);\n${makeBlank(count * 3)}});`);
					}
				}

				while (count) {
					fromJsonLines.unshift(`${makeBlank(count * 2)}v.forEach((v) {\n${makeBlank(count * 3)}final arr${count} = ${genericStringGenerator(innerClass, total - count).slice(4)}[];`);
					fromJsonLines.push(`${makeBlank(count * 3)}arr${count - 1}.add(arr${count});\n${makeBlank(count * 2)}});`);
					toJsonLines.unshift(`${makeBlank(count * 2)}v${shouldNullSafe ? '!' : ''}.forEach((v) {\n${makeBlank(count * 3)}final arr${count} = [];`);
					toJsonLines.push(`${makeBlank(count * 3)}arr${count - 1}.add(arr${count});\n${makeBlank(count * 2)}});`);
					count--;
				}

				let typeCheck = shouldEnhanceFaultTolerance ? ` && (json[${jsonKey}] is List)` : '';
				fromJsonLines.unshift(`${makeBlank(1)}if (json[${jsonKey}] != null${typeCheck}) {\n${makeBlank(2)}final v = json[${jsonKey}];\n${makeBlank(2)}final arr0 = ${genericStringGenerator(innerClass, total).slice(4)}[];`);
				fromJsonLines.push(`${makeBlank(1)}${makeBlank(count)}${legalKey} = arr0;\n    }\n`);
				toJsonLines.unshift(`    if (${legalKey} != null) {\n      final v = ${legalKey};\n      final arr0 = [];`);
				toJsonLines.push(`      data[${jsonKey}] = arr0;\n    }\n`);

				let fromJsonLinesJoined = fromJsonLines.join('\r\n');
				let toJsonLinesJoined = toJsonLines.join('\r\n');
				return {
					fromJsonLinesJoined,
					toJsonLinesJoined
				};
			};

			//!json object to dart
			let objToDart = (jsonObj, prefix, baseClass) => {

				if (Array.isArray(jsonObj)) {
					return objToDart(jsonObj[0], prefix, baseClass);
				}

				let lines = [];
				let jsonKeysLines = [];
				let propsLines = [];
				let constructorLines = [];
				let fromJsonLines = [];
				let toJsonLines = [];

				/// TODO: init settings properties
				let shouldUsingJsonKey = $('#usingJsonKeyCheckBox').prop('checked');
				let isJsonKeyPrivate = $('#jsonKeyPrivateCheckBox').prop('checked');
				let shouldEnhanceFaultTolerance = $('#faultToleranceCheckBox').prop('checked');
				let shouldNullSafe = true; //$('#nullSafeCheckBox').prop('checked');
				let shouldConvertSnakeToCamel = true; // $('#camelCheckBox').prop('checked');
				let shouldOridJson = false;// $('#origJsonCheckBox').prop('checked');
				// ~ new
				let removeFromJson = $('#removeFromJson').prop('checked');
				let removeToJson = $('#removeToJson').prop('checked');
				let removeConstructors = $('#removeConstructors').prop('checked');
				

				let className = `${prefix}${uppercaseFirst(baseClass)}`;
				
				if (shouldConvertSnakeToCamel) {
					className = snakeToCamel(className);
				}

				lines.push(`class ${className} {`);
				// lines.push(`/*\r\n${JSON.stringify(jsonObj, null, 2)} \r\n*/\r\n`);
				constructorLines.push(`  ${className}({\n`);
				fromJsonLines.push(`  ${className}.fromJson(Map<String, dynamic> json) {\n`);
				if (shouldOridJson) {
					fromJsonLines.push(`    __origJson = json;\n`);
				}
				toJsonLines.push(`  Map<String, dynamic> toJson() {\n`);
				toJsonLines.push(`    final data = <String, dynamic>{};\n`);

				for (let key in jsonObj) {
					if (jsonObj.hasOwnProperty(key)) {
						let element = jsonObj[key];

						let legalKey = dartKeywordDefence(key);

						if (shouldConvertSnakeToCamel) {
							legalKey = snakeToCamel(legalKey);
						}

						let thisData = '';
						if (key == 'data') {
							thisData = 'this.';
						}

						let jsonKey = `'${key}'`;
						if (shouldUsingJsonKey) {
							jsonKey = `${isJsonKeyPrivate ? '_' : ''}jsonKey${className}${uppercaseFirst(legalKey)}`;
						}
						jsonKeysLines.push(`const String ${jsonKey} = '${key}';`);
						constructorLines.push(`    this.${legalKey},\n`);
						if (element === null) {
							//!Display error information
							showInfo(` 💬 WARNING : the Property named '${key}' is null,which will be treated as String type`);
							element = '';
						}
						if (typeof element === 'object') {

							let subClassName = `${className}${uppercaseFirst(key)}`;
							if (shouldConvertSnakeToCamel) {
								subClassName = snakeToCamel(subClassName);
							}
							if (Array.isArray(element)) {
								let {
									inner,
									innerClass,
									count
								} = getInnerObjInfo(element, subClassName);
								let {
									fromJsonLinesJoined,
									toJsonLinesJoined
								} = getIterateLines(element, subClassName, key, legalKey, jsonKey, shouldNullSafe);
								let genericString = genericStringGenerator(innerClass, count);
								
								/// TODO: PENTING -> null safe in arraylist
								if (shouldNullSafe) {
									genericString = genericString.replaceAll('>', '?>') + '?';
								}
								
								/// TODO: fixme when array.length = 0
								if(element[0] != null ){
									propsLines.push(`  ${genericString} ${legalKey};\n`);
								} else {
									propsLines.push(`  List<dynamic>? ${legalKey};\n`);
								}


								fromJsonLines.push(fromJsonLinesJoined);
								toJsonLines.push(toJsonLinesJoined);
								if (typeof inner === 'object') {
									lines.unshift(objToDart(element, className, key));
								}
							} else {
								lines.unshift(objToDart(element, className, key));
								propsLines.push(`  ${subClassName}${shouldNullSafe ? '?' : ''} ${legalKey};\n`);
								let typeCheck = shouldEnhanceFaultTolerance ? ` && (json[${jsonKey}] is Map)` : '';
								fromJsonLines.push(`    ${legalKey} = (json[${jsonKey}] != null${typeCheck}) ? ${subClassName}.fromJson(json[${jsonKey}]) : null;\n`);
								toJsonLines.push(`    if (${thisData}${legalKey} != null) {\n      data[${jsonKey}] = ${thisData}${legalKey}${shouldNullSafe ? '!' : ''}.toJson();\n    }\n`);
							}
						} else {
							let toType = `json[${jsonKey}]`;
							let type = '';
							if (typeof element === 'boolean') {
								//bool is special
								// toType = `json[${jsonKey}] ?? false`; /// ? default value: boolean
								type = 'bool';
							} else {
								if (forceStringCheckBox) element = element.toString();

								/// TODO: fix default value
								if (typeof element === 'string') {
									toType = `json[${jsonKey}]?.toString() ?? ''`; /// ? default value: string
									type = 'String';
								} else if (typeof element === 'number') {
									if (Number.isInteger(element)) {
										toType = shouldEnhanceFaultTolerance ? `int.tryParse(json[${jsonKey}]?.toString() ?? '')` : `json[${jsonKey}]?.toInt() ?? 0`; /// ? default value: integer
										type = 'num';
									} else {
										toType = shouldEnhanceFaultTolerance ? `double.tryParse(json[${jsonKey}]?.toString() ?? '')` : `json[${jsonKey}]?.toDouble() ?? 0.0`; /// ? default value: double
										type = 'num';
									}
								}
							}
							propsLines.push(`  ${type}${shouldNullSafe ? '?' : ''} ${legalKey};\n`);
							fromJsonLines.push(`    ${legalKey} = ${toType};\n`);
							toJsonLines.push(`    data[${jsonKey}] = ${thisData}${legalKey};\n`);
						}
					}
				}
				
				if (shouldOridJson) {
					propsLines.push(`  Map<String, dynamic> __origJson = {};\n`);
				}
				
				if (shouldUsingJsonKey) {
					lines.unshift(jsonKeysLines.join('\n'));
				}

				constructorLines.push(`  });`);
				fromJsonLines.push(`  }`);
				toJsonLines.push(`    return data;\n  }`);


				/// TODO: fix issue empty object
				if (constructorLines.length < 3) {
					constructorLines = [];
					constructorLines.push(`  ${className}();`);
				}

				lines.push(propsLines.join(''));

				if(removeConstructors) constructorLines = [];
				lines.push(constructorLines.join(''));
				if(removeFromJson) fromJsonLines = [];
				lines.push(fromJsonLines.join(''));
				if(removeToJson) toJsonLines = [];
				lines.push(toJsonLines.join(''));
				
				if (shouldOridJson) {
					lines.push(`  Map<String, dynamic> origJson() => __origJson;`);
				}

				lines.push(`}\n`);
				let linesOutput = lines.join('\r\n');
				return linesOutput;
			};

			removeSurplusElement(jsonObj);

			let rootClass = $('#classNameTextField').val() ?? 'MyModel';
			let dartCode = `${objToDart(jsonObj, rootClass.length > 0 ? rootClass : 'MyModel', "")}`;

			resultDartCode = dartCode;
			let highlightDartCode = hljs.highlight('dart', dartCode);
			$('#dartCode').html(highlightDartCode.value);

			/// * filename suggestion 
			$('#fileNameTextField').val(rootClass.length > 0 ? rootClass.replace(/([A-Z])/g, "_$1").toLowerCase().substr(1) + '_entity.dart' : '');
		}

		function textFieldBinding(tfID, defaultValue) {
			let selector = '#' + tfID;
			let strFromCookie = $.cookie(tfID);
			if ((strFromCookie === undefined || strFromCookie.length === 0) && defaultValue) {
				$.cookie(tfID, defaultValue);
			}
			$(selector).val($.cookie(tfID));
			$(selector).on('input', function (e) {
				let text = $(this).val();
				$.cookie(tfID, text);
				generate();
			});
		}

		textFieldBinding('classNameTextField', 'MyModel');

		function jsonEditorBinding(tfID, defaultValue) {
			let str = $.cookie(jsonEditorCachekey);
			if (str && str.length) {
				editor.setText(str);
			} else {
				editor.set(jsonTestCase);
			}
		}
		jsonEditorBinding();

		function checkBoxBinding(checkBoxID, checked) {
			let defaultValue = checked ? '1' : '0';
			let selector = '#' + checkBoxID;
			let strFromCookie = $.cookie(checkBoxID);
			if (strFromCookie === undefined || strFromCookie.length === 0) {
				$.cookie(checkBoxID, defaultValue);
			}
			checked = $.cookie(checkBoxID) === '1';
			$(selector).prop('checked', checked);
			$(selector).on('change', function () {
				let checked = $(this).prop('checked') ? '1' : '0';
				$.cookie(checkBoxID, checked);
				generate();
			});
		}

		/// * checkbox default value
		checkBoxBinding('jsonKeyPrivateCheckBox', true);
		checkBoxBinding('usingJsonKeyCheckBox', false);
		checkBoxBinding('nullSafeCheckBox', true);
		checkBoxBinding('camelCheckBox', true);
		checkBoxBinding('faultToleranceCheckBox', false);
		checkBoxBinding('forceStringCheckBox', false);
		checkBoxBinding('origJsonCheckBox', false);
		// ~ new
		checkBoxBinding('removeFromJson', false);
		checkBoxBinding('removeToJson', false);
		checkBoxBinding('removeConstructors', false);


		$('#usingJsonKeyCheckBox').on('change', function () {
			$('#jsonKeyPrivateCheckBox').prop('disabled', !(this.checked));
		});
		$('#jsonKeyPrivateCheckBox').prop('disabled', !($('#usingJsonKeyCheckBox').prop('checked')));

		generate();

		function copyToClipboard(text) {
			var $temp = $("<textarea>");
			$("body").append($temp);
			$temp.val(text).select();
			document.execCommand("copy");
			$temp.remove();
		}

		$('#copyFileBtn').click(function () {
			copyToClipboard(resultDartCode);
		});

	})();
});