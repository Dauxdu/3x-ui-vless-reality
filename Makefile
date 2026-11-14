ANSIBLE := ansible-playbook ansible/setup.yml
INVENTORY := -i ansible/inventory/hosts.yml

.PHONY: help init inode onode site check

help:
	@echo "make init     — установить коллекции Ansible из requirements.yml"
	@echo "make inode     — провижининг iNode (SSH, UFW, 3x-ui)"
	@echo "make onode     — провижининг oNode (SSH, UFW, nginx, 3x-ui)"
	@echo "make site      — обновить только сайт+nginx на oNode"
	@echo "make check     — синтакс-проверка плейбуков и линт ролей"

init:
	ansible-galaxy collection install -r ansible/requirements.yml

inode:
	$(ANSIBLE) $(INVENTORY) -l inode

onode:
	$(ANSIBLE) $(INVENTORY) -l onode

site:
	ansible-playbook $(INVENTORY) ansible/site.yml

check:
	ansible-playbook $(INVENTORY) ansible/setup.yml --syntax-check
	ansible-playbook $(INVENTORY) ansible/site.yml --syntax-check
	ansible-lint ansible/roles/deploy_nginx ansible/roles/deploy_3x_ui
