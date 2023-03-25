var modalModeNewUser = false;
var currEdit = "";
mymodal = new mdb.Modal(document.getElementById('userEditModal'));
admmodal = new mdb.Modal(document.getElementById('adminEditModal'));

var PASSWORD_REGEX = /^[a-zA-Z0-9_.-]{2,}$/g;
var LOGIN_REGEX = /^[a-zA-Z0-9_.-]{3,16}$/g;
var EMAIL_REGEX = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g;

$(document).ready(function () {
  loadUsersList();
  loadZetroxSettings();
  new mdb.Tooltip(document.getElementById('tooltip-acc'));
});

function loadZetroxSettings() {
  $.get("/zetrox/config", function (data) {
    zetroxCfg = data;
    if (zetroxCfg['lang'] == "hu") {
      $("#hungarianRadio").attr("checked", true);
    } else if (zetroxCfg['lang'] == "en") {
      $("#englishRadio").attr("checked", true);
    } else if (zetroxCfg['lang'] == "ru") {
      $("#russianRadio").attr("checked", true);
    } else if (zetroxCfg['lang'] == "nl") {
      $("#dutchRadio").attr("checked", true);
    }

    if (zetroxCfg['ftpd'] == true) {
      $("#ftpserver-checkbox").attr("checked", true);
    }

    if (zetroxCfg['auth'] == true) {
      $("#auth-checkbox").attr("checked", true);
    }

    if (zetroxCfg['save-logs'] == true) {
      $("#savelogs-checkbox").attr("checked", true);
    }

    if (zetroxCfg['internet-access'] == true) {
      $("#allowintacc-checkbox").attr("checked", true);
    }

    $(".ftppass").val(zetroxCfg["ftpd-password"]);
    $(".ftpuser").val(zetroxCfg["ftpd-user"]);

    $.get("/zetrox/support-uid", function(supuid){
      $("#supuid").text(supuid);
    });
  });
}

function shutdownZetrox(){
  $.get("/zetrox/shutdown");
}

function setNewUserMode(bool) {
  if (bool) {
    $("#userEditModal #userEditModalLabel").text("{{adding-usr-ks}}");
    $("#userEditModal .password-input").show();
    $("#userEditModal .usrname-group").show();
    $("#userEditModal .buttons-cont").hide();
    modalModeNewUser = true;
  } else {
    $("#userEditModal #userEditModalLabel").text("{{editing-usr-ks}}");
    $("#userEditModal .password-input").hide();
    $("#userEditModal .usrname-group").hide();
    $("#userEditModal .buttons-cont").show();
    modalModeNewUser = false;
  }
  setModalDefaultValues();
}

function setModalDefaultValues() {
  $("#userEditModal input[type=checkbox]:not(:disabled)").each(function () {
    $(this).prop("checked", false);
  });
  $("#userEditModal input[type=text], #userEditModal input[type=password], #userEditModal input[type=email]").each(function () {
    $(this).val("");
  });
}

function openNewUserModal() {
  setNewUserMode(true);
  setModalDefaultValues();
  mymodal.show();
}

function saveUser() {
  usrname = $("#userEditModal .usrname-input").val();
  mail = $("#userEditModal .mail-input").val();
  if (mail == "" || mail.match(EMAIL_REGEX)) {
    if (usrname.match(LOGIN_REGEX)) {
      perms = [];
      $("#userEditModal input[type=checkbox]:checked:not(:disabled)").each(function () {
        perm = $(this).data("perm");
        perms.push(perm);
      });
      perms = perms.join(",");
      if (modalModeNewUser == true) {
        passwd = $("#userEditModal .password-input").val();
        if (passwd.match(PASSWORD_REGEX)) {
          $.get("/auth/newUser?login=" + usrname + "&mail=" + mail + "&permissions=" + perms + "&password=" + passwd, function (res) {
            if (res == "Users count is limited to 5 users") {
              Toastify({
                text: "{{users-limited-count-ks}}",
                duration: 3000,
                newWindow: true,
                close: false,
                gravity: "bottom",
                position: "left",
                stopOnFocus: true,
                style: {
                  background: "#dc4c64",
                  color: "white",
                },
                onClick: function () {}
              }).showToast();
            }
            mymodal.hide();
            loadUsersList();
          });
        }
      } else {
        $.get("/auth/editUser?login=" + usrname + "&mail=" + mail + "&permissions=" + perms, function () {
          mymodal.hide();
          loadUsersList();
        });
      }
    }
  }
}

function setModalDataByUserInfo(userInfo) {
  setModalDefaultValues();
  currEdit = userInfo.username;
  $("#userEditModal .usrname-input").val(userInfo.username);
  $("#userEditModal .mail-input").val(userInfo.mail);
  perms = userInfo.permissions;
  $("#userEditModal input[type=checkbox]").each(function () {
    perm = $(this).data("perm");
    if (perms.includes(perm)) {
      $(this).prop("checked", true);
    }
  });
}

function saveZetroxSettings() {
  rl_page = false;
  ftpd = $("#ftpserver-checkbox").is(":checked");
  auth = $("#auth-checkbox").is(":checked");
  savelogs = $("#savelogs-checkbox").is(":checked");
  allowint = $("#allowintacc-checkbox").is(":checked");

  if(zetroxCfg['auth'] != auth){
    rl_page = true;
  }
  if(zetroxCfg['ftpd'] != ftpd && ftpd == false){
    alert("Az FTPD letiltásához a Zetrox teljes újraindítása szükséges");
  }
  zetroxCfg["ftpd"] = ftpd;
  zetroxCfg["auth"] = auth;
  zetroxCfg["internet-access"] = allowint;
  zetroxCfg["save-logs"] = savelogs;
  zetroxCfg["ftpd-password"] = $(".ftppass").val();
  zetroxCfg["ftpd-user"] = $(".ftpuser").val();
  $.get("/zetrox/saveConfig?data=" + encodeURI(JSON.stringify(zetroxCfg)), function (data) {
    $.get("/zetrox/setFTPDStatus?value=" + ftpd, function (data) {
      if(rl_page == false){
        loadZetroxSettings();
        Toastify({
          text: "{{settings-saved}}",
          duration: 3000,
          newWindow: true,
          close: false,
          gravity: "bottom",
          position: "left",
          stopOnFocus: true,
          style: {
            background: "#0067f4",
            color: "white",
          },
          onClick: function () {}
        }).showToast();
      } else {
        location.reload();
      }
    });
  });
}

function changeAdminPass() {
  oldPass = $("#adminEditModal .opassword-input").val();
  newPass = $("#adminEditModal .npassword-input").val();
  $.get("/auth/changeAdminPass?oldPass=" + oldPass + "&newPass=" + newPass, function (ret) {
    if (ret == true) {
      admmodal.hide();
      window.location = "/";
    } else {
      $("#adminEditModal .opassword-input").val("");
      $("#adminEditModal .npassword-input").val("");
    }
  });
}

function deleteCurrUserAccount() {
  $.get("/auth/deleteUser?login=" + currEdit, function () {
    mymodal.hide();
    loadUsersList();
  });
}

function regenCurrUserHash() {
  $.get("/auth/regenUserHash?login=" + currEdit, function () {
    mymodal.hide();
    loadUsersList();
  });
}

function openEditAdminModal() {
  admmodal.show();
}

function openEditUserModal(username) {
  setNewUserMode(false);
  $.get("/auth/getUserInfo?username=" + username, function (usrdata) {
    setModalDataByUserInfo(usrdata);
    mymodal.show();
  });
}

function loadUsersList() {
  $("#users-list .col-xl-4.ucard").each(function () {
    $(this).remove();
  });
  $.get("/auth/listUsers", function (users) {
    $("#users-list").append('<div class="col-xl-4 col-lg-6 ucard"><div class="card" onclick="openEditAdminModal()"><div class="card-body"><div class="d-flex align-items-center"><span class="material-symbols-outlined">admin_panel_settings</span><div class="ms-3"><p class="fw-bold mb-1">zetrox</p><p class="text-muted mb-0">{{admin-acc-ks}}</p></div></div></div></div></div>');
    for (const [key, value] of Object.entries(users)) {
      usr = value;
      if (usr.mail == "undefined" || usr.mail == null || usr.mail == "") {
        usr.mail = "{{mail-no-ks}}";
      }
      if (usr.username != "zetrox") {
        $("#users-list").append('<div class="col-xl-4 col-lg-6 ucard"><div class="card" onclick="openEditUserModal(' + "'" + usr.username + "'" +
          ')"><div class="card-body"><div class="d-flex align-items-center"><span class="material-symbols-outlined">account_circle</span><div class="ms-3"><p class="fw-bold mb-1">' + usr.username + '</p><p class="text-muted mb-0">' + usr.mail + '</p></div></div></div></div></div>');
      }
    }
  });
}