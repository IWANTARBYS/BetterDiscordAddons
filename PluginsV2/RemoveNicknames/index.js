module.exports = (Plugin, Api, Vendor) => {
	if (typeof BDfunctionsDevilBro !== "object") global.BDfunctionsDevilBro = {$: Vendor.$, BDv2Api: Api};
	
	const {$} = Vendor;

	return class extends Plugin {
		onStart() {
			var libraryScript = null;
			if (typeof BDfunctionsDevilBro !== "object" || typeof BDfunctionsDevilBro.isLibraryOutdated !== "function" || BDfunctionsDevilBro.isLibraryOutdated()) {
				libraryScript = document.querySelector('head script[src="https://mwittrien.github.io/BetterDiscordAddons/Plugins/BDfunctionsDevilBro.js"]');
				if (libraryScript) libraryScript.remove();
				libraryScript = document.createElement("script");
				libraryScript.setAttribute("type", "text/javascript");
				libraryScript.setAttribute("src", "https://mwittrien.github.io/BetterDiscordAddons/Plugins/BDfunctionsDevilBro.js");
				document.head.appendChild(libraryScript);
			}
			this.startTimeout = setTimeout(() => {this.initialize();}, 30000);
			if (typeof BDfunctionsDevilBro === "object" && typeof BDfunctionsDevilBro.isLibraryOutdated === "function") this.initialize();
			else libraryScript.addEventListener("load", () => {this.initialize();});
			return true;
		}
		
		initialize() {
			if (typeof BDfunctionsDevilBro === "object") {
				this.updateUsers = false;
				
				this.defaults = {
					settings: {
						replaceOwn:		{value:false, 	description:"Replace your own name:"},
						addNickname:	{value:false, 	description:"Add nickname as parentheses:"}
					}
				};
				
				BDfunctionsDevilBro.loadMessage(this);
			
				this.UserStore = BDfunctionsDevilBro.WebModules.findByProperties(["getUsers", "getUser"]);
				this.MemberPerms = BDfunctionsDevilBro.WebModules.findByProperties(["getNicknames", "getNick"]);
				
				var observer = null;

				observer = new MutationObserver((changes, _) => {
					changes.forEach(
						(change, i) => {
							if (change.addedNodes) {
								change.addedNodes.forEach((node) => {
									if (node && node.tagName && node.querySelector(".userDefault-2_cnT0")) {
										this.loadUser(node.querySelector(".userDefault-2_cnT0").parentElement, "voice", false);
									}
								});
							}
						}
					);
				});
				BDfunctionsDevilBro.addObserver(this, ".channels-3g2vYe", {name:"channelListObserver",instance:observer}, {childList: true, subtree: true});
				
				observer = new MutationObserver((changes, _) => {
					changes.forEach(
						(change, i) => {
							if (change.addedNodes) {
								change.addedNodes.forEach((node) => {
									if (node && node.tagName && node.querySelector(".username-MwOsla")) {
										this.loadUser(node, "list", false);
									}
								});
							}
						}
					);
				});
				BDfunctionsDevilBro.addObserver(this, ".members-1bid1J", {name:"userListObserver",instance:observer}, {childList:true});
				
				observer = new MutationObserver((changes, _) => {
					changes.forEach(
						(change, i) => {
							if (change.addedNodes) {
								change.addedNodes.forEach((node) => {
									if ($(".message-group").has(".avatar-large").length > 0) {
										if (node && node.tagName && node.querySelector(".username-wrapper")) {
											this.loadUser(node, "chat", false);
										}
										else if (node && node.classList && node.classList.contains("message-text")) {
											this.loadUser($(".message-group").has(node)[0], "chat", false);
										}
									}
									else {
										if (node && node.tagName && node.querySelector(".username-wrapper")) {
											if (node.classList.contains("markup")) {
												this.loadUser(node, "chat", true);
											}
											else {
												var markups = node.querySelectorAll(".markup");
												for (var i = 0; i < markups.length; i++) {
													this.loadUser(markups[i], "chat", true);
												}
											}
										}
									}
								});
							}
						}
					);
				});
				BDfunctionsDevilBro.addObserver(this, ".messages.scroller", {name:"chatWindowObserver",instance:observer}, {childList:true, subtree:true});
				
				this.loadAllUsers();
			
				return true;
			}
			else {
				console.error(this.name + ": Fatal Error: Could not load BD functions!");
				return false;
			}
		}

		onStop() {
			if (typeof BDfunctionsDevilBro === "object") {
				this.resetAllUsers();
							
				BDfunctionsDevilBro.unloadMessage(this);
				return true;
			}
			else {
				return false;
			}
		}
	
		onSwitch () {
			if (typeof BDfunctionsDevilBro === "object") {
				this.loadAllUsers();
				BDfunctionsDevilBro.addObserver(this, ".members-1bid1J", {name:"userListObserver"}, {childList:true});
				BDfunctionsDevilBro.addObserver(this, ".messages.scroller", {name:"chatWindowObserver"}, {childList:true, subtree:true});
			}
		}

	
		// begin of own functions

		updateSettings (settingspanel) {
			var settings = {};
			for (var input of settingspanel.querySelectorAll(".checkbox-1KYsPm")) {
				settings[input.value] = input.checked;
			}
			this.updateUsers = true;
			BDfunctionsDevilBro.saveAllData(settings, this, "settings");
		}

		loadAllUsers () {
			for (let user of document.querySelectorAll(".member-2FrNV0")) {
				this.loadUser(user, "list", false);
			} 
			for (let user of document.querySelectorAll(".message-group")) {
				if (user.querySelector(".avatar-large")) {
					this.loadUser(user, "chat", false);
				}
				else {
					for (let markup of user.querySelectorAll(".markup")) {
						this.loadUser(markup, "chat", true);
					}
				}
			}
			for (let user of document.querySelectorAll(".userDefault-2_cnT0")) {
				this.loadUser(user.parentElement, "voice", false);
			}
		}
		
		loadUser (div, type, compact) {
			if (!div || div.getAttribute("removed-nickname") || !div.tagName) return;
			
			let usernameWrapper = this.getNameWrapper(div);
			if (!usernameWrapper) return;
			
			$(div).data("compact", compact);
			
			var info = this.getUserInfo(compact ? $(".message-group").has(div)[0] : div);
			if (!info) return;
			
			var settings = BDfunctionsDevilBro.getAllData(this, "settings");
			if (info.id == BDfunctionsDevilBro.myData.id && !settings.replaceOwn) return;
			
			var serverObj = BDfunctionsDevilBro.getSelectedServer();
			if (!serverObj) return;
			
			var member = this.MemberPerms.getMember(serverObj.id, info.id);
			if (!member || !member.nick) return;
			
			BDfunctionsDevilBro.setInnerText(usernameWrapper, settings.addNickname ? info.username + " (" + member.nick + ")" : info.username);
				
			div.setAttribute("removed-nickname", true);
		}
		
		resetAllUsers () {
			document.querySelectorAll("[removed-nickname]").forEach((div) => {
				let usernameWrapper = this.getNameWrapper(div);
				if (!usernameWrapper) return;
				
				var info = this.getUserInfo($(div).data("compact") ? $(".message-group").has(div)[0] : div);
				if (!info) return;
				
				var serverObj = BDfunctionsDevilBro.getSelectedServer();
				if (!serverObj) return;
				
				var member = this.MemberPerms.getMember(serverObj.id, info.id);
				if (!member || !member.nick) return;
				
				BDfunctionsDevilBro.setInnerText(usernameWrapper, member.nick);
					
				div.removeAttribute("removed-nickname");
			});
		}
		
		getNameWrapper (div) {
			return div.querySelector(".nameDefault-1I0lx8, .username-MwOsla, .user-name");
		}
		
		getUserInfo (div) {
			var info = {id:div.getAttribute("data-user-id") || div.getAttribute("data-author-id")};
			if (!info.id) {
				info = BDfunctionsDevilBro.getKeyInformation({"node":div,"key":"user"});
				if (!info) {
					info = BDfunctionsDevilBro.getKeyInformation({"node":div,"key":"message"});
					if (info) info = info.author;
					else {
						info = BDfunctionsDevilBro.getKeyInformation({"node":div,"key":"channel"});
						if (info) info = {"id":info.recipients[0]};
						else {
							info = BDfunctionsDevilBro.getKeyInformation({"node":$(".message-group").has(div)[0],"key":"message"});
							if (info) info = info.author;
						}
					}
				}
			}
			return info && info.id ? this.UserStore.getUser(info.id) : null;
		}
		
		getSettingsPanel () {
			var settings = BDfunctionsDevilBro.getAllData(this, "settings"); 
			var settingshtml = `<div class="DevilBro-settings">`;
			for (let key in settings) {
				settingshtml += `<div class="flex-lFgbSz flex-3B1Tl4 horizontal-2BEEBe horizontal-2VE-Fw directionRow-yNbSvJ justifyStart-2yIZo0 alignCenter-3VxkQP noWrap-v6g9vO marginBottom8-1mABJ4" style="flex: 1 1 auto;"><h3 class="titleDefault-1CWM9y title-3i-5G_ marginReset-3hwONl weightMedium-13x9Y8 size16-3IvaX_ height24-2pMcnc flexChild-1KGW5q" style="flex: 1 1 auto;">${this.defaults.settings[key].description}</h3><div class="flexChild-1KGW5q switchEnabled-3CPlLV switch-3lyafC value-kmHGfs sizeDefault-rZbSBU size-yI1KRe themeDefault-3M0dJU" style="flex: 0 0 auto;"><input type="checkbox" value="${key}" class="checkboxEnabled-4QfryV checkbox-1KYsPm"${settings[key] ? " checked" : ""}></div></div>`;
			}
			settingshtml += `</div>`;
			
			var settingspanel = $(settingshtml)[0];

			$(settingspanel)
				.on("click", ".checkbox-1KYsPm", () => {this.updateSettings(settingspanel);});
			return settingspanel;
		}
		
		onSettingsClosed () {
			if (this.updateUsers) {
				this.resetAllUsers();
				this.loadAllUsers();
				this.updateUsers = false;
			}
		}
	}
};